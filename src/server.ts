import intApp from "./index";

const PORT = process.env.PORT;

intApp().then((app) => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
