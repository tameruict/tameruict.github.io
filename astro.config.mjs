import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://tameruict.github.io",
  output: "static",
  markdown: {
    shikiConfig: {
      theme: "rose-pine",
      wrap: true,
    },
  },
});
