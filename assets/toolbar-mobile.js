class Toolbarmobile extends HTMLElement {
  constructor() {
    super();

    if (theme.config.mqlSmall || theme.config.isTouch) this.init();
  }

  init() {
    this.activate();
    this.setHeight();
    window.addEventListener('resize', theme.utils.rafThrottle(this.setHeight.bind(this)));
  }

  activate() {
    const header = document.querySelector(".header[data-sticky-state='inactive]");
    header === null
      ? this.classList.add("active")
      : this.classList.remove("active");
  }

  setHeight() {
    document.body.style.setProperty('--toolbar-mobile-height', `${this.clientHeight}px`);
  }
}
customElements.define("toolbar-mobile", Toolbarmobile);

/* =========================================================
   UNIVERSes RAW
   TOOLBAR ISOLATION
   Do not interfere with Header / Menu / Drawers
   ========================================================= */

@media screen and (max-width: 989px) {

  .toolbar-mobile {
    position: fixed !important;

    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;

    width: 100% !important;

    z-index: 100 !important;

    pointer-events: none !important;

    isolation: isolate;
  }


  .toolbar-mobile__inner {
    pointer-events: auto !important;

    position: relative !important;

    z-index: 101 !important;
  }


  /* Never allow toolbar to affect theme drawers */

  .toolbar-mobile
  .drawer,

  .toolbar-mobile
  .side-drawer,

  .toolbar-mobile
  .menu-drawer,

  .toolbar-mobile
  header-drawer,

  .toolbar-mobile
  details,

  .toolbar-mobile
  summary {

    all: revert;
  }


  /* Keep the actual header menu above normal page content */

  .header__icon--menu {
    position: relative;

    z-index: 200;
  }


  /* The menu drawer must always sit above toolbar */

  #Drawer-Menu {
    z-index: 10000;
  }

}