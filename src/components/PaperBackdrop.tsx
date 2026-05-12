import { useEffect, useState } from "react";
import { HalftoneDots } from "@paper-design/shaders-react";

function readTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function PaperBackdrop() {
  const [theme, setTheme] = useState<"light" | "dark">(readTheme);

  useEffect(() => {
    const update = () => setTheme(readTheme());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const colorBack = theme === "light" ? "#f2f1e8" : "#1c1f24";
  const colorFront = theme === "light" ? "#2b2b2b" : "#fbf0df";

  return (
    <div className="paper-backdrop" aria-hidden="true">
      <HalftoneDots
        style={{ width: "100%", height: "100%" }}
        colorBack={colorBack}
        colorFront={colorFront}
        type="gooey"
        grid="hex"
        size={0.5}
        radius={1.25}
        contrast={0.4}
        grainMixer={0.2}
        grainOverlay={0.2}
        grainSize={0.5}
        scale={1}
        fit="cover"
        originalColors={false}
        inverted={false}
      />
    </div>
  );
}
