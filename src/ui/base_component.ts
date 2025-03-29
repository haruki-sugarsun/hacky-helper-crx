export abstract class BaseComponent extends HTMLElement {
  protected static sharedSheet: CSSStyleSheet;
  protected shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
  }

  protected initialize(styles: string): ShadowRoot {
    const ctor = this.constructor as typeof BaseComponent;
    if (!ctor.sharedSheet) {
      ctor.sharedSheet = new CSSStyleSheet();
      ctor.sharedSheet.replaceSync(styles);
    }
    this.shadow.adoptedStyleSheets = [ctor.sharedSheet];
    return this.shadow;
  }
}
