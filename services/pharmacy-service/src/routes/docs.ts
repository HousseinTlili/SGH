import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { fileURLToPath } from "url";

export const docsRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openapiPath = path.resolve(__dirname, "../../openapi.yaml");

let swaggerDoc: any = null;
try {
  swaggerDoc = YAML.load(openapiPath);
} catch (e) {
  try {
    swaggerDoc = YAML.load(path.resolve(process.cwd(), "openapi.yaml"));
  } catch {
    swaggerDoc = {};
  }
}

docsRouter.get("/openapi.json", (req, res) => {
  res.status(200).json(swaggerDoc);
});

docsRouter.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));
