<h1 align="center">RabbitMQ to Salesforce Integration</h1>
<p align="center">
  <b>Asynchronous order integration proof of concept</b><br/>
  Orders are published to RabbitMQ and processed by a worker that pushes them to Salesforce — decoupled, fault-tolerant and loss-free.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-Node.js-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/RabbitMQ-queue-FF6600?style=flat-square&logo=rabbitmq&logoColor=white" />
  <img src="https://img.shields.io/badge/Salesforce-API-00A1E0?style=flat-square&logo=salesforce&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-API-000000?style=flat-square&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/React-frontend-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/GitHub%20Actions-CI%2FCD-2088FF?style=flat-square&logo=githubactions&logoColor=white" />
</p>

---

## Architecture

```
Producer (REST API / CLI)
        │  publish order
        ▼
RabbitMQ ── orders_queue ──▶ Consumer (worker) ──▶ Salesforce REST API
        │
        └── orders_dlq   (messages that fail after max retries)
```

Systems never talk to each other directly: the queue absorbs failures in Salesforce, so no order is lost when the external API is down.

## Features

- **Producer** — Express API that validates orders and publishes them to RabbitMQ.
- **Consumer** — worker that reads the queue, authenticates against Salesforce and creates records.
- **Dead-letter queue** — failed messages are retried, then moved to `orders_dlq` instead of being dropped.
- **Security** — API key authentication, rate limiting and Helmet headers on the API.
- **Frontend** — React dashboard to send test orders and follow their status.
- **CI/CD** — GitHub Actions pipelines for build, lint and deployment.

## Status

| Component | Status |
|---|---|
| Producer | Working |
| RabbitMQ (queues + DLQ) | Working |
| Consumer | Working up to Salesforce |
| Salesforce API | OAuth configuration in progress (`invalid_grant`) |

The integration layer behaves as intended: while Salesforce authentication fails, messages stay safely in the queue.

## Tech stack

| Layer | Technology |
|---|---|
| Messaging | RabbitMQ (amqplib) |
| API | Node.js, Express, TypeScript |
| Security | API key, express-rate-limit, Helmet |
| Target system | Salesforce REST API (OAuth 2.0) |
| Frontend | React, Vite |
| CI/CD | GitHub Actions |

## Getting started

Requirements: Node.js 20+, a running RabbitMQ instance (management UI on `http://localhost:15672`), a Salesforce developer org.

```bash
git clone https://github.com/oiseaubleuc/TestingDemo.git
cd TestingDemo
npm install
cp env.example .env          # fill in RabbitMQ and Salesforce settings

npm run start:api            # producer API
npm run start:consumer       # worker
npm run start:frontend       # dashboard
```

---

<p align="center">Built by <a href="https://github.com/oiseaubleuc">Hoho</a> · Belgium</p>
