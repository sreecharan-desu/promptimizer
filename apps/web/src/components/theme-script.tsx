export function ThemeScript() {
  const code = `
    (function () {
      try {
        var stored = localStorage.getItem("promptimizer-theme");
        var theme = stored || "dark";
        if (theme === "system") {
          theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
        }
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(theme);
      } catch (e) {
        document.documentElement.classList.add("dark");
      }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
