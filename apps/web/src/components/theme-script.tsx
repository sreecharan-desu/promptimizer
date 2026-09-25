/** Always force dark mode — no light / system preference. */
export function ThemeScript() {
  const code = `
    (function () {
      try {
        localStorage.setItem("promptimizer-theme", "dark");
      } catch (e) {}
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
