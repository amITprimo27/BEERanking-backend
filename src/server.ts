import initApp from "./index";
import { EnvConfig } from "./config/env.config";

const PORT = EnvConfig.instance.PORT;

initApp().then((app) => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
