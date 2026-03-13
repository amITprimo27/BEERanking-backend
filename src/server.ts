import initApp from "./index";

const PORT = process.env.PORT;

initApp().then((app) => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
