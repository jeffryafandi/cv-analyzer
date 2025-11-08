# CV Analyzer API

A RESTful API service for analyzing CVs and project reports using AI/LLM. The system processes PDF documents, evaluates them against job descriptions or rubrics, and provides detailed analysis reports through an asynchronous job queue system.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [Elysia](https://elysiajs.com/)
- **Database**: MongoDB
- **Cache/Queue**: Redis
- **Vector Database**: ChromaDB
- **Job Queue**: BullMQ
- **Queue Monitoring**: Bull Board (with Basic Auth)
- **AI Services**: Google Gemini / OpenRouter
- **API Documentation**: Swagger/OpenAPI

## API Documentation

Once the server is running, you can access the interactive API documentation at:

```
http://localhost:3000/api-docs
```

The API documentation provides detailed information about all available endpoints, request/response schemas, and allows you to test the API directly from the browser.

## Running Locally

### Prerequisites

- [Bun](https://bun.sh/) installed
- MongoDB running (default: `mongodb://localhost:27017`)
- Redis running (default: `redis://localhost:6379`)
- ChromaDB running (default: `http://localhost:8000`)

### Setup

1. Install dependencies:

```bash
bun install
```

2. Create a `.env` file with the required environment variables:

```env
MONGODB_URI=mongodb://localhost:27017/cv-analyzer
REDIS_URI=redis://localhost:6379
CHROMA_URL=http://localhost:8000
GEMINI_API_KEY=your_gemini_api_key
# OR
OPENROUTER_API_KEY=your_openrouter_api_key
PREFERRED_AI_SERVICE=gemini  # or "openrouter"
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=admin
PORT=3000
```

3. Start the development server:

```bash
bun run dev
```

4. Start the worker (in a separate terminal):

```bash
bun run dev:worker
```

The API will be available at `http://localhost:3000`

## Running with Docker Compose

The easiest way to run the entire stack is using Docker Compose, which will start all required services:

1. Create a `.env` file with your configuration (see above)

2. Start all services:

```bash
docker-compose up -d
```

This will start:

- **MongoDB** on port `27017`
- **Redis** on port `6379`
- **ChromaDB** on port `8000`
- **Backend API** on port `3000` (or your configured PORT)
- **Worker** process for job processing

3. View logs:

```bash
docker-compose logs -f
```

4. Stop all services:

```bash
docker-compose down
```

## Bull Board

Bull Board provides a web-based UI for monitoring and managing your job queues. It's available at:

```
http://localhost:3000/admin/queues
```

### Authentication

Bull Board is protected with Basic Authentication. Use the credentials configured in your `.env` file:

- **Username**: Set via `BULL_BOARD_USERNAME` (default: `admin`)
- **Password**: Set via `BULL_BOARD_PASSWORD` (default: `admin`)

When accessing the Bull Board UI, your browser will prompt you for these credentials.

## Development

- `bun run dev` - Start the development server with hot reload
- `bun run dev:worker` - Start the worker process with hot reload
- `bun run build` - Build the backend for production
- `bun run build:worker` - Build the worker for production
- `bun run start` - Start the production server
- `bun run start:worker` - Start the production worker
