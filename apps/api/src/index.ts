import { app } from "./app";

const port = parseInt(process.env["PORT"] ?? "4000", 10);

app.listen(port, () => {
  console.log(`[API] Server running on port ${port}`);
});

export { app };
