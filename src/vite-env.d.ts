/// <reference types="vite/client" />

declare module "virtual:termix-boot-locale" {
  const bootTranslation: Record<string, unknown>;
  export default bootTranslation;
}

declare module "*.svg?react" {
  import type { FC, SVGProps } from "react";
  const ReactComponent: FC<SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}
