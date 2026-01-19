import axios, { AxiosInstance } from 'axios';
import { SalesforceAuthService } from './salesforce-auth';
import logger from '../utils/logger';

/**
 * Resultaat van een Salesforce operatie
 */
export interface SalesforceResultaat {
  isSuccesvol: boolean;
  isHerhaalbaar: boolean; // true voor tijdelijke fouten (429, 5xx), false voor permanente fouten (400, 4xx)
  foutmelding?: string;
  statusCode?: number;
  leadId?: string;
}

/**
 * Order Message interface
 */
export interface OrderMessage {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  // Optionele velden voor Lead mapping
  brand?: string;
  name?: string;
}

/**
 * Customer payload (voor consumer)
 */
export interface CustomerMessage {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
}

/**
 * Salesforce Client
 * Verstuurt data naar Salesforce via REST API
 */
export class SalesforceClient {
  private authService: SalesforceAuthService;
  private axiosInstance: AxiosInstance;

  // ✅ Maak authService optioneel zodat andere code gewoon `new SalesforceClient()` kan doen
  constructor(authService?: SalesforceAuthService) {
    this.authService = authService ?? new SalesforceAuthService();
    this.axiosInstance = axios.create();
  }

  /**
   * ✅ Wrapper voor compatibiliteit met consumer.ts
   * Consumer verwacht stuurOrderAsync, maar oudere client had stuurBestellingAsync
   */
  async stuurOrderAsync(bestelling: OrderMessage): Promise<SalesforceResultaat> {
    return this.stuurBestellingAsync(bestelling);
  }

  /**
   * ✅ Wrapper voor compatibiliteit met consumer.ts
   * Als jullie (nog) geen Customers naar Salesforce sturen, maak dit expliciet “permanent fail”
   * zodat je flow duidelijk is en CI wel groen wordt.
   */
  async stuurCustomerAsync(_customer: CustomerMessage): Promise<SalesforceResultaat> {
    return {
      isSuccesvol: false,
      isHerhaalbaar: false,
      foutmelding: 'Customer sync is not implemented in SalesforceClient (yet).',
      statusCode: 400,
    };
  }

  /**
   * Verstuurt een bestelling naar Salesforce als Lead record
   */
  async stuurBestellingAsync(bestelling: OrderMessage): Promise<SalesforceResultaat> {
    try {
      // Zorg dat we een geldig access token hebben
      const accessToken = await this.authService.haalAccessTokenOpAsync();
      const instanceUrl = this.authService.getInstanceUrl();
      const apiVersion = this.authService.getApiVersion();

      // Maak Lead data aan
      const leadData = {
        Company: bestelling.brand || `Order ${bestelling.id}`, // Verplicht veld
        LastName: bestelling.name || `Order #${bestelling.id}`, // Verplicht veld
        Description: this.maakOrderBeschrijving(bestelling),
        LeadSource: 'RabbitMQ',
        ExternalId__c: bestelling.id // Custom field voor order ID
      };

      // Maak Lead aan in Salesforce
      const response = await axios.post(
        `${instanceUrl}/services/data/${apiVersion}/sobjects/Lead`,
        leadData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Salesforce: Bestelling succesvol verstuurd', {
        orderId: bestelling.id,
        leadId: response.data.id
      });

      return {
        isSuccesvol: true,
        isHerhaalbaar: false,
        leadId: response.data.id
      };
    } catch (error: any) {
      return this.verwerkSalesforceResponse(error, bestelling.id);
    }
  }

  /**
   * Verstuurt een fallback bericht voor niet-JSON berichten
   */
  async stuurFallbackBerichtAsync(bericht: string, berichtId: string): Promise<SalesforceResultaat> {
    try {
      const accessToken = await this.authService.haalAccessTokenOpAsync();
      const instanceUrl = this.authService.getInstanceUrl();
      const apiVersion = this.authService.getApiVersion();

      const leadData = {
        Company: 'Onbekende Bestelling',
        LastName: `Bericht ${berichtId}`,
        Description: `Raw bericht: ${bericht}`,
        LeadSource: 'RabbitMQ - Fallback',
        ExternalId__c: berichtId
      };

      const response = await axios.post(
        `${instanceUrl}/services/data/${apiVersion}/sobjects/Lead`,
        leadData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Salesforce: Fallback bericht succesvol verstuurd', {
        berichtId,
        leadId: response.data.id
      });

      return {
        isSuccesvol: true,
        isHerhaalbaar: false,
        leadId: response.data.id
      };
    } catch (error: any) {
      return this.verwerkSalesforceResponse(error, berichtId);
    }
  }

  /**
   * Verwerkt Salesforce API response en bepaalt of retry nodig is
   */
  private verwerkSalesforceResponse(error: any, orderId: string): SalesforceResultaat {
    const statusCode = error.response?.status;
    const foutmelding =
      error.response?.data?.message ||
      error.response?.data?.error_description ||
      error.message ||
      'Onbekende fout';

    // 401 Unauthorized - Token is verlopen, probeer opnieuw na refresh
    if (statusCode === 401) {
      logger.warn('Salesforce: 401 Unauthorized - Token refresh nodig', {
        orderId,
        foutmelding
      });

      // Forceer token refresh voor volgende poging
      this.authService.forceerTokenRefreshAsync().catch((err) => {
        logger.error('Salesforce: Kon token niet refreshen na 401', {
          error: err.message
        });
      });

      return {
        isSuccesvol: false,
        isHerhaalbaar: true, // 401 is tijdelijk (na token refresh)
        foutmelding: `Unauthorized: ${foutmelding}`,
        statusCode: 401
      };
    }

    // 429 Too Many Requests - Rate limiting, tijdelijk
    if (statusCode === 429) {
      logger.warn('Salesforce: 429 Too Many Requests - Rate limiting', {
        orderId,
        foutmelding
      });

      return {
        isSuccesvol: false,
        isHerhaalbaar: true,
        foutmelding: `Rate limit: ${foutmelding}`,
        statusCode: 429
      };
    }

    // 5xx Server Errors - Tijdelijke server problemen
    if (statusCode && statusCode >= 500 && statusCode < 600) {
      logger.error('Salesforce: Server error', {
        orderId,
        statusCode,
        foutmelding
      });

      return {
        isSuccesvol: false,
        isHerhaalbaar: true,
        foutmelding: `Server error: ${foutmelding}`,
        statusCode
      };
    }

    // 400, 4xx Client Errors - Permanente fouten
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      logger.error('Salesforce: Client error - permanente fout', {
        orderId,
        statusCode,
        foutmelding,
        errorDetails: error.response?.data
      });

      return {
        isSuccesvol: false,
        isHerhaalbaar: false, // Permanente fout
        foutmelding: `Client error: ${foutmelding}`,
        statusCode
      };
    }

    // Onbekende fout - behandel als tijdelijk
    logger.error('Salesforce: Onbekende fout', {
      orderId,
      statusCode,
      foutmelding
    });

    return {
      isSuccesvol: false,
      isHerhaalbaar: true,
      foutmelding,
      statusCode
    };
  }

  private maakOrderBeschrijving(bestelling: OrderMessage): string {
    const items = bestelling.items
      .map((i) => `- ${i.productId} x${i.quantity} @ ${i.price}`)
      .join('\n');

    return `Order ID: ${bestelling.id}
Customer ID: ${bestelling.customerId}
Amount: ${bestelling.amount} ${bestelling.currency}

Items:
${items}`;
  }
}
