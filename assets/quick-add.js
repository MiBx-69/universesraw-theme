/* ============================================================
   UNIVERSES RAW — ULTRA FAST QUICK ADD
   ============================================================ */

(function () {
  'use strict';

  /*
   * Prevent duplicate custom-element registration.
   */
  if (customElements.get('quick-add-modal')) {
    return;
  }


  /*
   * ------------------------------------------------------------
   * PRODUCT HTML CACHE
   * ------------------------------------------------------------
   *
   * Stores:
   *
   * URL -> Promise<Response HTML>
   *
   * This means:
   *
   * Hover product
   *      ↓
   * Fetch starts
   *      ↓
   * User clicks
   *      ↓
   * Same request is reused
   *
   * No second network request.
   */

  const quickAddCache = new Map();


  /*
   * ------------------------------------------------------------
   * PREFETCH LIMIT
   * ------------------------------------------------------------
   *
   * Don't allow hundreds of products to download at once.
   */

  const MAX_PREFETCHES = 4;

  let activePrefetches = 0;


  /*
   * ------------------------------------------------------------
   * IMAGE CACHE
   * ------------------------------------------------------------
   */

  const imageCache = new Set();


  /*
   * ------------------------------------------------------------
   * QUICK ADD MODAL
   * ------------------------------------------------------------
   */

  customElements.define(
    'quick-add-modal',

    class QuickAddModal extends ModalDialog {

      constructor() {

        super();


        /*
         * Main content container.
         */

        this.modalContent =
          this.querySelector(
            '#QuickStandardModal'
          );


        /*
         * Product-info initialization.
         */

        this.addEventListener(
          'product-info:loaded',
          ({ target }) => {

            if (
              target &&
              typeof target.addPreProcessCallback ===
                'function'
            ) {

              target.addPreProcessCallback(
                this.preprocessHTML.bind(this)
              );

            }

          }
        );

      }


      /*
       * ========================================================
       * HIDE
       * ========================================================
       */

      hide(preventFocus = false) {

        const cartNotification =
          document.querySelector(
            'cart-drawer'
          );


        if (
          cartNotification &&
          this.openedBy
        ) {

          cartNotification.setActiveElement(
            this.openedBy
          );

        }


        /*
         * Keep existing behavior.
         *
         * We clear the previous product after
         * the modal has closed.
         */

        setTimeout(
          () => {

            if (this.modalContent) {

              this.modalContent.innerHTML = '';

            }

          },
          500
        );


        if (preventFocus) {

          this.openedBy = null;

        }


        super.hide();

      }


      /*
       * ========================================================
       * SHOW
       * ========================================================
       */

      show(opener) {

        if (!opener) {

          return;

        }


        const productUrl =
          opener.getAttribute(
            'data-product-url'
          );


        if (!productUrl) {

          console.warn(
            'Quick Add: product URL is missing.'
          );

          return;

        }


        const spinner =
          opener.querySelector(
            '.loading__spinner'
          );


        opener.setAttribute(
          'aria-disabled',
          'true'
        );

        opener.classList.add(
          'loading'
        );


        if (spinner) {

          spinner.classList.remove(
            'hidden'
          );

        }


        /*
         * Convert product URL to Quick Add URL.
         */

        const quickAddUrl =
          this.getQuickAddUrl(
            productUrl
          );


        /*
         * Make sure the modal container exists.
         */

        if (!this.modalContent) {

          console.error(
            'Quick Add: #QuickStandardModal was not found.'
          );

          this.finishLoading(
            opener,
            spinner
          );

          return;

        }


        /*
         * ======================================================
         * INSTANT OPEN IF PRODUCT IS ALREADY CACHED
         * ======================================================
         */

        const cached =
          quickAddCache.get(
            quickAddUrl
          );


        if (cached) {

          /*
           * We already have the product request.
           *
           * Open modal immediately if the
           * cached HTML has already resolved.
           */

          if (
            cached.status ===
            'resolved'
          ) {

            this.insertProduct(
              cached.html,
              opener,
              productUrl,
              spinner
            );

            return;

          }


          /*
           * Request is currently running.
           *
           * Show the modal immediately with a
           * lightweight loading state while
           * reusing the same request.
           */

          this.showInstantLoadingState(
            opener
          );


          /*
           * Open modal BEFORE waiting for network.
           */

          super.show(
            opener
          );


          cached.promise
            .then(
              (html) => {

                this.insertProductIntoOpenModal(
                  html,
                  opener,
                  productUrl,
                  spinner
                );

              }
            )
            .catch(
              (error) => {

                this.handleError(
                  error,
                  productUrl,
                  opener
                );

              }
            )
            .finally(
              () => {

                this.finishLoading(
                  opener,
                  spinner
                );

              }
            );

          return;

        }


        /*
         * ======================================================
         * NO CACHE
         * ======================================================
         *
         * First click without previous prefetch.
         *
         * Start request immediately.
         */

        const request =
          this.fetchProduct(
            quickAddUrl
          );


        /*
         * Save request immediately.
         */

        quickAddCache.set(
          quickAddUrl,
          {
            status: 'loading',
            promise: request
          }
        );


        /*
         * ======================================================
         * OPEN MODAL IMMEDIATELY
         * ======================================================
         *
         * This is the major UX improvement.
         */

        this.showInstantLoadingState(
          opener
        );


        super.show(
          opener
        );


        /*
         * Populate content when request finishes.
         */

        request
          .then(
            (html) => {

              /*
               * Save resolved HTML.
               */

              quickAddCache.set(
                quickAddUrl,
                {
                  status: 'resolved',
                  html: html
                }
              );


              /*
               * Insert into already-open modal.
               */

              this.insertProductIntoOpenModal(
                html,
                opener,
                productUrl,
                spinner
              );

            }
          )
          .catch(
            (error) => {

              /*
               * Remove broken cache entry.
               */

              quickAddCache.delete(
                quickAddUrl
              );


              this.handleError(
                error,
                productUrl,
                opener
              );

            }
          )
          .finally(
            () => {

              this.finishLoading(
                opener,
                spinner
              );

            }
          );

      }


      /*
       * ========================================================
       * GET QUICK ADD URL
       * ========================================================
       */

      getQuickAddUrl(productUrl) {

        return (
          productUrl.split('?')[0] +
          '?view=quick_add'
        );

      }


      /*
       * ========================================================
       * FETCH PRODUCT
       * ========================================================
       */

      fetchProduct(quickAddUrl) {

        return fetch(
          quickAddUrl,
          {
            method: 'GET',

            headers: {
              'X-Requested-With':
                'XMLHttpRequest',

              'Accept':
                'text/html'
            },

            credentials:
              'same-origin',

            cache:
              'force-cache'
          }
        )
          .then(
            (response) => {

              if (!response.ok) {

                throw new Error(
                  `Quick Add request failed: ${response.status}`
                );

              }

              return response.text();

            }
          );

      }


      /*
       * ========================================================
       * INSTANT LOADING STATE
       * ========================================================
       */

      showInstantLoadingState(opener) {

        if (!this.modalContent) {

          return;

        }


        /*
         * Very lightweight loading UI.
         *
         * The modal itself opens immediately.
         */

        this.modalContent.innerHTML = `
          <div
            class="universes-quick-add-loading"
            aria-live="polite"
            aria-busy="true"
          >
            <div class="universes-quick-add-loading__image"></div>

            <div class="universes-quick-add-loading__content">

              <div class="universes-quick-add-loading__line"></div>

              <div class="universes-quick-add-loading__line universes-quick-add-loading__line--short"></div>

              <div class="universes-quick-add-loading__variants">

                <span></span>
                <span></span>
                <span></span>
                <span></span>

              </div>

            </div>
          </div>
        `;


        /*
         * Lightweight inline CSS.
         *
         * No external request required.
         */

        if (
          !document.getElementById(
            'UniversesQuickAddInstantCSS'
          )
        ) {

          const style =
            document.createElement(
              'style'
            );


          style.id =
            'UniversesQuickAddInstantCSS';


          style.textContent = `

            .universes-quick-add-loading {
              display: grid;
              grid-template-columns: 120px minmax(0, 1fr);
              gap: 16px;
              width: 100%;
              min-height: 180px;
              padding: 12px;
              box-sizing: border-box;
            }

            .universes-quick-add-loading__image {
              width: 100%;
              aspect-ratio: 1 / 1;
              border-radius: 4px;
              background:
                linear-gradient(
                  90deg,
                  #f3f3f3 25%,
                  #e9e9e9 50%,
                  #f3f3f3 75%
                );
              background-size: 200% 100%;
              animation:
                universesQuickAddShimmer
                1s infinite linear;
            }

            .universes-quick-add-loading__content {
              padding-top: 10px;
            }

            .universes-quick-add-loading__line {
              height: 13px;
              width: 85%;
              margin-bottom: 12px;
              border-radius: 3px;
              background:
                linear-gradient(
                  90deg,
                  #f3f3f3 25%,
                  #e9e9e9 50%,
                  #f3f3f3 75%
                );
              background-size: 200% 100%;
              animation:
                universesQuickAddShimmer
                1s infinite linear;
            }

            .universes-quick-add-loading__line--short {
              width: 55%;
            }

            .universes-quick-add-loading__variants {
              display: flex;
              gap: 7px;
              margin-top: 24px;
            }

            .universes-quick-add-loading__variants span {
              width: 34px;
              height: 30px;
              border-radius: 3px;
              background: #f0f0f0;
            }

            @keyframes universesQuickAddShimmer {
              from {
                background-position: 200% 0;
              }

              to {
                background-position: -200% 0;
              }
            }

            @media screen and (max-width: 749px) {

              .universes-quick-add-loading {
                grid-template-columns: 100px minmax(0, 1fr);
                gap: 12px;
                min-height: 160px;
              }

            }

          `;


          document.head.appendChild(
            style
          );

        }

      }


      /*
       * ========================================================
       * INSERT PRODUCT INTO OPEN MODAL
       * ========================================================
       */

      insertProductIntoOpenModal(
        responseText,
        opener,
        productUrl,
        spinner
      ) {

        try {

          const responseHTML =
            new DOMParser().parseFromString(
              responseText,
              'text/html'
            );


          const productElement =
            responseHTML.querySelector(
              'product-info'
            );


          if (!productElement) {

            throw new Error(
              'Quick Add: product-info element was not found.'
            );

          }


          this.insertProductElement(
            productElement
          );


          /*
           * Product content is now visible.
           */

          this.finishProductInitialization();


          /*
           * Preload product images.
           */

          this.preloadProductImages(
            this.modalContent
          );


        } catch (error) {

          this.handleError(
            error,
            productUrl,
            opener
          );

        }

      }


      /*
       * ========================================================
       * INSERT CACHED PRODUCT
       * ========================================================
       */

      insertProduct(
        responseText,
        opener,
        productUrl,
        spinner
      ) {

        try {

          /*
           * Make sure modal is open.
           */

          if (
            !this.openedBy
          ) {

            super.show(
              opener
            );

          }


          this.insertProductIntoOpenModal(
            responseText,
            opener,
            productUrl,
            spinner
          );


        } catch (error) {

          this.handleError(
            error,
            productUrl,
            opener
          );

        } finally {

          this.finishLoading(
            opener,
            spinner
          );

        }

      }


      /*
       * ========================================================
       * INSERT PRODUCT ELEMENT
       * ========================================================
       */

      insertProductElement(
        productElement
      ) {

        if (
          !this.modalContent
        ) {

          throw new Error(
            'Quick Add: #QuickStandardModal was not found.'
          );

        }


        /*
         * Process BEFORE inserting.
         */

        this.preprocessHTML(
          productElement
        );


        /*
         * Use Shopify's existing HTML utility.
         */

        HTMLUpdateUtility.setInnerHTML(
          this.modalContent,
          productElement.outerHTML
        );

      }


      /*
       * ========================================================
       * PRODUCT INITIALIZATION
       * ========================================================
       */

      finishProductInitialization() {

        /*
         * Product subtotals.
         */

        if (
          typeof window.initProductSubtotals ===
          'function'
        ) {

          window.initProductSubtotals(
            this.modalContent
          );

        }


        /*
         * Shopify accelerated checkout.
         */

        if (
          window.Shopify &&
          Shopify.PaymentButton
        ) {

          try {

            Shopify.PaymentButton.init();

          } catch (error) {

            console.warn(
              'Quick Add PaymentButton initialization failed.',
              error
            );

          }

        }


        /*
         * Product models / AR.
         */

        if (
          window.ProductModel &&
          typeof window.ProductModel
            .loadShopifyXR ===
            'function'
        ) {

          try {

            window.ProductModel
              .loadShopifyXR();

          } catch (error) {

            console.warn(
              'Quick Add Shopify XR initialization failed.',
              error
            );

          }

        }

      }


      /*
       * ========================================================
       * PRELOAD PRODUCT IMAGES
       * ========================================================
       */

      preloadProductImages(
        container
      ) {

        if (!container) {

          return;

        }


        const images =
          container.querySelectorAll(
            'img[src], img[data-src], img[data-srcset]'
          );


        images.forEach(
          (image) => {

            let src =
              image.currentSrc ||
              image.src ||
              image.dataset.src;


            if (!src) {

              return;

            }


            /*
             * Convert Shopify image URL into
             * a browser-cacheable request.
             */

            if (
              image.dataset.src
            ) {

              src =
                image.dataset.src;

            }


            if (
              imageCache.has(src)
            ) {

              return;

            }


            imageCache.add(
              src
            );


            const preload =
              new Image();


            preload.decoding =
              'async';


            preload.src =
              src;


            /*
             * If srcset exists, preload the
             * highest browser-selected source
             * as well.
             */

            if (
              image.dataset.srcset
            ) {

              preload.srcset =
                image.dataset.srcset;

            }

          }
        );

      }


      /*
       * ========================================================
       * FINISH BUTTON LOADING
       * ========================================================
       */

      finishLoading(
        opener,
        spinner
      ) {

        if (!opener) {

          return;

        }


        opener.removeAttribute(
          'aria-disabled'
        );


        opener.classList.remove(
          'loading'
        );


        if (spinner) {

          spinner.classList.add(
            'hidden'
          );

        }

      }


      /*
       * ========================================================
       * ERROR HANDLING
       * ========================================================
       */

      handleError(
        error,
        productUrl,
        opener
      ) {

        console.error(
          'Universes RAW Quick Add error:',
          error
        );


        if (
          !this.modalContent
        ) {

          return;

        }


        this.modalContent.innerHTML = `
          <div
            class="quick-add-error"
            role="alert"
          >

            <p>
              Unable to load product options.
            </p>

            <a
              href="${productUrl}"
              class="button"
            >
              View Product
            </a>

          </div>
        `;


        /*
         * Make sure the modal is visible.
         */

        if (
          !this.openedBy
        ) {

          super.show(
            opener
          );

        }

      }


      /*
       * ========================================================
       * PREPROCESS HTML
       * ========================================================
       */

      preprocessHTML(
        productElement
      ) {

        if (!productElement) {

          return;

        }


        /*
         * Copy product color/gradient classes
         * to modal.
         */

        productElement.classList.forEach(
          (classApplied) => {

            if (
              classApplied.startsWith(
                'color-'
              ) ||
              classApplied ===
                'gradient'
            ) {

              if (
                this.modalContent
              ) {

                this.modalContent.classList.add(
                  classApplied
                );

              }

            }

          }
        );


        /*
         * Prevent duplicate IDs.
         */

        this.preventDuplicatedIDs(
          productElement
        );


        /*
         * Remove unnecessary product-page
         * elements.
         */

        this.removeDOMElements(
          productElement
        );


        /*
         * Gallery accessibility.
         */

        this.removeGalleryListSemantic(
          productElement
        );


        /*
         * Prevent variant URL changes.
         */

        this.preventVariantURLSwitching(
          productElement
        );

      }


      /*
       * ========================================================
       * PREVENT VARIANT URL SWITCHING
       * ========================================================
       */

      preventVariantURLSwitching(
        productElement
      ) {

        productElement.setAttribute(
          'data-update-url',
          'false'
        );

      }


      /*
       * ========================================================
       * REMOVE PRODUCT PAGE ELEMENTS
       * ========================================================
       */

      removeDOMElements(
        productElement
      ) {

        /*
         * Pickup availability.
         */

        const pickupAvailability =
          productElement.querySelector(
            'pickup-availability'
          );


        if (
          pickupAvailability
        ) {

          pickupAvailability.remove();

        }


        /*
         * Share button.
         */

        const shareButton =
          productElement.querySelector(
            'share-button'
          );


        if (
          shareButton
        ) {

          shareButton.remove();

        }


        /*
         * Product modal.
         */

        const productModal =
          productElement.querySelector(
            'product-modal'
          );


        if (
          productModal
        ) {

          productModal.remove();

        }


        /*
         * Nested modal dialogs.
         */

        const modalDialogs =
          productElement.querySelectorAll(
            'modal-dialog'
          );


        if (
          modalDialogs.length
        ) {

          modalDialogs.forEach(
            (modal) => {

              modal.remove();

            }
          );

        }


        /*
         * Side drawer openers.
         */

        const sideDrawerOpeners =
          productElement.querySelectorAll(
            'side-drawer-opener'
          );


        if (
          sideDrawerOpeners.length
        ) {

          sideDrawerOpeners.forEach(
            (button) => {

              if (
                !button.classList.contains(
                  'product-popup-modal__opener--keep'
                )
              ) {

                button.remove();

              }

            }
          );

        }


        /*
         * Side drawers.
         */

        const sideDrawers =
          productElement.querySelectorAll(
            'side-drawer'
          );


        if (
          sideDrawers.length
        ) {

          sideDrawers.forEach(
            (drawer) => {

              if (
                !drawer.classList.contains(
                  'product-popup-modal__drawer--keep'
                )
              ) {

                drawer.remove();

              }

            }
          );

        }

      }


      /*
       * ========================================================
       * PREVENT DUPLICATED IDs
       * ========================================================
       */

      preventDuplicatedIDs(
        productElement
      ) {

        const sectionId =
          productElement.dataset.section;


        if (!sectionId) {

          return;

        }


        const oldId =
          sectionId;


        const newId =
          `quickadd-${sectionId}`;


        /*
         * Replace section references inside HTML.
         */

        productElement.innerHTML =
          productElement.innerHTML.replaceAll(
            oldId,
            newId
          );


        /*
         * Replace section references inside attributes.
         */

        Array.from(
          productElement.attributes
        ).forEach(
          (attribute) => {

            if (
              attribute.value.includes(
                oldId
              )
            ) {

              productElement.setAttribute(
                attribute.name,

                attribute.value.replace(
                  oldId,
                  newId
                )
              );

            }

          }
        );


        productElement.dataset.originalSection =
          sectionId;

      }


      /*
       * ========================================================
       * GALLERY ACCESSIBILITY
       * ========================================================
       */

      removeGalleryListSemantic(
        productElement
      ) {

        const galleryList =
          productElement.querySelector(
            '[id^="Slider-Gallery"]'
          );


        if (!galleryList) {

          return;

        }


        galleryList.setAttribute(
          'role',
          'presentation'
        );


        galleryList
          .querySelectorAll(
            '[id^="Slide-"]'
          )
          .forEach(
            (li) => {

              li.setAttribute(
                'role',
                'presentation'
              );

            }
          );

      }

    }

  );


  /*
   * ============================================================
   * PRODUCT PREFETCH ENGINE
   * ============================================================
   *
   * This runs outside the modal class.
   *
   * It lets us start downloading a product before
   * the customer clicks Quick Add.
   */


  function prefetchProduct(
    productUrl
  ) {

    if (!productUrl) {

      return;

    }


    const quickAddUrl =
      productUrl.split('?')[0] +
      '?view=quick_add';


    /*
     * Already cached or loading.
     */

    if (
      quickAddCache.has(
        quickAddUrl
      )
    ) {

      return;

    }


    /*
     * Don't overload the browser.
     */

    if (
      activePrefetches >=
      MAX_PREFETCHES
    ) {

      return;

    }


    activePrefetches++;


    const request =
      fetch(
        quickAddUrl,
        {
          method: 'GET',

          headers: {
            'X-Requested-With':
              'XMLHttpRequest',

            'Accept':
              'text/html'
          },

          credentials:
            'same-origin',

          cache:
            'force-cache'
        }
      )
        .then(
          (response) => {

            if (!response.ok) {

              throw new Error(
                `Quick Add prefetch failed: ${response.status}`
              );

            }

            return response.text();

          }
        )
        .then(
          (html) => {

            quickAddCache.set(
              quickAddUrl,
              {
                status: 'resolved',
                html: html
              }
            );


            /*
             * Decrease active request count.
             */

            activePrefetches--;


            /*
             * Warm the browser image cache.
             */

            try {

              const parsed =
                new DOMParser()
                  .parseFromString(
                    html,
                    'text/html'
                  );


              const images =
                parsed.querySelectorAll(
                  'img[src], img[data-src]'
                );


              images.forEach(
                (image) => {

                  const src =
                    image.getAttribute(
                      'src'
                    ) ||
                    image.getAttribute(
                      'data-src'
                    );


                  if (
                    !src ||
                    imageCache.has(src)
                  ) {

                    return;

                  }


                  imageCache.add(
                    src
                  );


                  const preload =
                    new Image();


                  preload.decoding =
                    'async';


                  preload.src =
                    src;

                }
              );

            } catch (error) {}



            return html;

          }
        )
        .catch(
          (error) => {

            activePrefetches--;

            quickAddCache.delete(
              quickAddUrl
            );

            return null;

          }
        );


    quickAddCache.set(
      quickAddUrl,
      {
        status: 'loading',
        promise: request
      }
    );


    return request;

  }


  /*
   * ============================================================
   * FIND QUICK ADD OPENERS
   * ============================================================
   */

  function setupQuickAddPrefetch() {

    /*
     * Event delegation.
     *
     * Works with dynamically loaded collection products.
     */

    document.addEventListener(
      'pointerover',
      function (event) {

        const opener =
          event.target.closest(
            'modal-opener[data-modal="#QuickAddStandard"]'
          );


        if (!opener) {

          return;

        }


        const productUrl =
          opener.getAttribute(
            'data-product-url'
          );


        if (productUrl) {

          prefetchProduct(
            productUrl
          );

        }

      },
      {
        passive: true
      }
    );


    /*
     * Focus.
     */

    document.addEventListener(
      'focusin',
      function (event) {

        const opener =
          event.target.closest(
            'modal-opener[data-modal="#QuickAddStandard"]'
          );


        if (!opener) {

          return;

        }


        const productUrl =
          opener.getAttribute(
            'data-product-url'
          );


        if (productUrl) {

          prefetchProduct(
            productUrl
          );

        }

      }
    );


    /*
     * Touch / mobile.
     */

    document.addEventListener(
      'touchstart',
      function (event) {

        const opener =
          event.target.closest(
            'modal-opener[data-modal="#QuickAddStandard"]'
          );


        if (!opener) {

          return;

        }


        const productUrl =
          opener.getAttribute(
            'data-product-url'
          );


        if (productUrl) {

          prefetchProduct(
            productUrl
          );

        }

      },
      {
        passive: true
      }
    );


    /*
     * Keyboard accessibility.
     */

    document.addEventListener(
      'keydown',
      function (event) {

        if (
          event.key !== 'Enter' &&
          event.key !== ' '
        ) {

          return;

        }


        const opener =
          event.target.closest(
            'modal-opener[data-modal="#QuickAddStandard"]'
          );


        if (!opener) {

          return;

        }


        const productUrl =
          opener.getAttribute(
            'data-product-url'
          );


        if (productUrl) {

          prefetchProduct(
            productUrl
          );

        }

      }
    );

  }


  /*
   * ============================================================
   * VIEWPORT PREFETCH
   * ============================================================
   *
   * When product cards are approaching the viewport,
   * quietly start loading their Quick Add HTML.
   *
   * This is especially useful on mobile.
   */

  function setupViewportPrefetch() {

    if (
      !('IntersectionObserver' in window)
    ) {

      return;

    }


    const observer =
      new IntersectionObserver(
        function (entries) {

          entries.forEach(
            function (entry) {

              if (
                !entry.isIntersecting
              ) {

                return;

              }


              const opener =
                entry.target;


              const productUrl =
                opener.getAttribute(
                  'data-product-url'
                );


              if (productUrl) {

                prefetchProduct(
                  productUrl
                );

              }


              observer.unobserve(
                opener
              );

            }
          );

        },
        {
          rootMargin:
            '500px 0px 500px 0px',

          threshold:
            0
        }
      );


    function observeOpeners() {

      document
        .querySelectorAll(
          'modal-opener[data-modal="#QuickAddStandard"][data-product-url]'
        )
        .forEach(
          function (opener) {

            observer.observe(
              opener
            );

          }
        );

    }


    /*
     * Initial products.
     */

    observeOpeners();


    /*
     * Shopify AJAX section updates.
     */

    document.addEventListener(
      'shopify:section:load',
      function () {

        observeOpeners();

      }
    );

  }


  /*
   * ============================================================
   * START PREFETCH SYSTEM
   * ============================================================
   */

  function initQuickAddPrefetch() {

    setupQuickAddPrefetch();

    setupViewportPrefetch();

  }


  /*
   * Wait until DOM exists.
   */

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      initQuickAddPrefetch,
      {
        once: true
      }
    );

  } else {

    initQuickAddPrefetch();

  }

})();