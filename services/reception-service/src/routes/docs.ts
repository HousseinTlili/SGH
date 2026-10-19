import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import yaml from "yamljs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openApiFilePath = path.resolve(__dirname, "../../openapi.yaml");
let swaggerDocument: any;

try {
  swaggerDocument = yaml.load(openApiFilePath);
} catch (e) {
  swaggerDocument = { openapi: "3.0.3", info: { title: "SGH Reception Service", version: "1.0.0" } };
}

export const docsRouter = Router();

docsRouter.get("/openapi.json", (_req, res) => {
  res.json(swaggerDocument);
});

docsRouter.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
