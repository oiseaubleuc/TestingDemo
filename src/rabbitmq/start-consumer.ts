import "dotenv/config";
import logger from "../utils/logger";
import { RabbitMQConsumer } from "./consumer";
import { SalesforceClient } from "../services/salesforce-client";

async function main() {
  logger.info("Starting RabbitMQ consumer...");

  // ✅ Maak Salesforce client aan en injecteer in de consumer
  const salesforceClient = new SalesforceClient();
  const consumer = new RabbitMQConsumer(salesforceClient);

  await consumer.connect();
  await consumer.startConsuming();

  logger.info("RabbitMQ consumer is running (waiting for messages)...");
}

main().catch((err) => {
  logger.error("Consumer crashed", { err });
  process.exit(1);
});

