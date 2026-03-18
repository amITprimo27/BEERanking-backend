import initApp from "./index";
import { EnvConfig } from "./config/env.config";
import fs from "fs";
import http from "http";
import https from "https";

const PORT = EnvConfig.instance.PORT;
const NODE_ENV = EnvConfig.instance.NODE_ENV;

initApp().then((app) => {
  if (NODE_ENV === "production") {
    const httpsOptions = {
      cert: fs.readFileSync("certs/client-cert.pem"),
      key: fs.readFileSync("certs/client-key.pem"),
    };
    https.createServer(httpsOptions, app).listen(PORT, () => {
      console.log(`Production server running with HTTPS on port ${PORT}`);
    });
  } else {
    http.createServer(app).listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  }
});
