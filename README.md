# CareMyCarAPI Node

Migracion a Node.js de CareMyCarAPI. Esta version usa Express, JavaScript puro CommonJS y MongoDB nativo para conservar la compatibilidad con la API Flask original.

## Estado

Base inicial creada para migrar modulo por modulo.

- `GET /health` listo
- `/api/auth` base inicial lista
- Modulos restantes con estructura preparada
- Predicciones ML reservadas para fase 2

## Stack

- Node.js
- Express
- MongoDB nativo
- JWT
- PDFKit
- Jest + Supertest
- ESLint + Prettier

## Configuracion

```bash
cp .env.example .env
```

Variables principales:

```bash
PORT=5000
NODE_ENV=development
SECRET_KEY=dev-secret
JWT_SECRET_KEY=dev-jwt-secret
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=vehicle_maintenance
```

## Comandos

```bash
npm run dev
npm start
npm test
npm run lint
npm run format
```

## Estructura

```text
src/
├── app.js
├── server.js
├── config/
├── db/
├── middleware/
├── modules/
│   ├── auth/
│   ├── catalog/
│   ├── vehicles/
│   ├── maintenance/
│   ├── parts/
│   ├── orders/
│   ├── service-orders/
│   └── predictions/
└── utils/
```

## Regla de migracion

La app Node debe conservar endpoints, codigos HTTP y respuestas JSON compatibles con Flask porque ya existe una app consumiendo el servicio.
