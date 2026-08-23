if (!customElements.get('product-form-component')) {
  customElements.define(
    'product-form-component',
    class ProductForm extends HTMLElement {

      constructor() {
        super();

        this.init();
      }


      /* ======================================================
         INIT
         ====================================================== */

      init() {

        this.form = this.querySelector('form');

        if (!this.form) return;

        this.variantIdInput.disabled = false;

        this.form.addEventListener(
          'submit',
          this.onSubmitHandler.bind(this)
        );

        this.cart =
          document.querySelector('cart-drawer');

        /*
         * Support both:
         *
         * Ella normal Add To Cart
         * Universes RAW Quick Add
         */

        this.submitButton =
          this.form.querySelector(
            '.add-to-cart-button'
          ) ||
          this.form.querySelector(
            '.universes-quick-add__submit'
          );

        this.submitButtonText =
          this.submitButton
            ? this.submitButton.querySelector('span')
            : null;

        this.checkbox =
          this.form.querySelector(
            '[id^="agree_condition-"]'
          );

        this.buyItNowButton =
          this.form.querySelector(
            '.shopify-payment-button'
          );


        if (
          document.querySelector('cart-drawer') &&
          this.submitButton
        ) {

          this.submitButton.setAttribute(
            'aria-haspopup',
            'dialog'
          );

        }


        this.hideErrors =
          this.dataset.hideErrors === 'true';


        this.initAgreeCondition();

        this.setupErrorSync();
      }


      /* ======================================================
         ERROR SYNC
         ====================================================== */

      setupErrorSync() {

        try {

          const productInfo =
            this.closest('product-info');

          const sectionId =
            productInfo?.dataset.section ||
            productInfo?.dataset.originalSection;

          if (!sectionId) return;


          const stickyATC =
            document.querySelector(
              `sticky-atc[data-sticky-section-id="${sectionId}"]`
            );

          if (!stickyATC) return;


          const mainErrorWrapper =
            this.querySelector(
              '.product-form__error-message-wrapper'
            );

          const stickyErrorWrapper =
            stickyATC.querySelector(
              '.product-form__error-message-wrapper'
            );


          if (
            !mainErrorWrapper ||
            !stickyErrorWrapper
          ) {
            return;
          }


          const syncFromMain = () => {

            const isVisible =
              !mainErrorWrapper.hasAttribute(
                'hidden'
              );


            const errorMessage =
              mainErrorWrapper.querySelector(
                '.product-form__error-message'
              )?.textContent;


            stickyErrorWrapper.toggleAttribute(
              'hidden',
              !isVisible || !errorMessage
            );


            if (
              isVisible &&
              errorMessage
            ) {

              const stickyErrorMessage =
                stickyErrorWrapper.querySelector(
                  '.product-form__error-message'
                );


              if (stickyErrorMessage) {

                stickyErrorMessage.textContent =
                  errorMessage;

              }

            }

          };


          syncFromMain();


          this._errorObserver =
            new MutationObserver(
              syncFromMain
            );


          this._errorObserver.observe(
            mainErrorWrapper,
            {
              attributes: true,
              attributeFilter: ['hidden'],
              childList: true,
              subtree: true
            }
          );


          this.cartErrorUnsubscriber =
            subscribe(
              PUB_SUB_EVENTS.cartError,
              () => {
                syncFromMain();
              }
            );


        } catch (e) {

          // Silent

        }

      }


      /* ======================================================
         AGREEMENT CONDITION
         ====================================================== */

      initAgreeCondition() {

        if (
          !this.checkbox ||
          !this.buyItNowButton
        ) {
          return;
        }


        this.buyItNowButton.classList.add(
          'disabled'
        );


        this.checkbox.addEventListener(
          'change',
          () => {

            this.buyItNowButton.classList.toggle(
              'disabled',
              !this.checkbox.checked
            );

          }
        );


        this.form.addEventListener(
          'submit',
          (e) => {

            if (!this.checkbox.checked) {

              e.preventDefault();

            }

          }
        );

      }


      /* ======================================================
         PREMIUM QUICK ADD NOTIFICATION
         ====================================================== */

      showQuickAddNotification() {

        /*
         * Remove any previous notification
         */

        const existing =
          document.querySelector(
            '.universes-cart-success'
          );


        if (existing) {

          existing.remove();

        }


        /*
         * Create notification
         */

        const notification =
          document.createElement('div');


        notification.className =
          'universes-cart-success';


        notification.innerHTML = `

          <div class="universes-cart-success__icon">

            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >

              <path
                d="M5 12.5L9.5 17L19 7"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

            </svg>

          </div>


          <div class="universes-cart-success__content">

            <div class="universes-cart-success__title">
              Added to your bag
            </div>

            <div class="universes-cart-success__text">
              Your item has been added successfully.
            </div>

          </div>


          <button
            type="button"
            class="universes-cart-success__close"
            aria-label="Close notification"
          >
            ×
          </button>

        `;


        document.body.appendChild(
          notification
        );


        /*
         * Trigger entrance animation
         */

        requestAnimationFrame(
          () => {

            notification.classList.add(
              'is-visible'
            );

          }
        );


        /*
         * Close function
         */

        const closeNotification = () => {

          notification.classList.remove(
            'is-visible'
          );


          setTimeout(
            () => {

              if (
                notification.parentNode
              ) {

                notification.remove();

              }

            },
            300
          );

        };


        /*
         * Manual close
         */

        const closeButton =
          notification.querySelector(
            '.universes-cart-success__close'
          );


        if (closeButton) {

          closeButton.addEventListener(
            'click',
            closeNotification
          );

        }


        /*
         * Automatic close
         */

        setTimeout(
          closeNotification,
          2800
        );

      }


      /* ======================================================
         SUBMIT
         ====================================================== */

      onSubmitHandler(evt) {

        evt.preventDefault();


        /*
         * Prevent double click
         */

        if (
          this.submitButton?.getAttribute(
            'aria-disabled'
          ) === 'true'
        ) {

          return;

        }


        /*
         * Detect Quick Add
         */

        const quickAddModal =
          this.closest(
            'quick-add-modal'
          );


        const isQuickAdd =
          !!quickAddModal;


        /*
         * Clear errors
         */

        this.handleErrorMessage();


        /*
         * Loading state
         */

        if (this.submitButton) {

          this.submitButton.setAttribute(
            'aria-disabled',
            true
          );


          this.submitButton.classList.add(
            'loading'
          );


          const spinner =
            this.submitButton.querySelector(
              '.loading__spinner'
            ) ||
            this.submitButton.querySelector(
              '.universes-quick-add__spinner'
            );


          if (spinner) {

            spinner.classList.remove(
              'hidden'
            );

          }

        }


        /* ==================================================
           STICKY ATC LOADING
           ================================================== */

        const productInfo =
          this.closest(
            'product-info'
          );


        const sectionId =
          productInfo?.dataset.section ||
          productInfo?.dataset.originalSection;


        const stickyAddButton =
          sectionId
            ? document.getElementById(
                `StickyCart-ProductSubmitButton-${sectionId}`
              )
            : undefined;


        const stickyLoadingSpinner =
          stickyAddButton?.querySelector(
            '.loading__spinner'
          );


        if (
          stickyAddButton &&
          stickyLoadingSpinner
        ) {

          stickyAddButton.classList.add(
            'loading'
          );


          stickyLoadingSpinner.classList.remove(
            'hidden'
          );

        }


        /* ==================================================
           AJAX CONFIG
           ================================================== */

        const config =
          fetchConfig(
            'javascript'
          );


        config.headers[
          'X-Requested-With'
        ] =
          'XMLHttpRequest';


        delete config.headers[
          'Content-Type'
        ];


        /* ==================================================
           FORM DATA
           ================================================== */

        const formData =
          new FormData(
            this.form
          );


        /* ==================================================
           CART SECTIONS
           ================================================== */

        if (this.cart) {

          formData.append(
            'sections',
            this.cart
              .getSectionsToRender()
              .map(
                (section) =>
                  section.id
              )
          );


          formData.append(
            'sections_url',
            window.location.pathname
          );


          this.cart.setActiveElement(
            document.activeElement
          );

        }


        /* ==================================================
           PRODUCT PROPERTIES
           ================================================== */

        const properties =
          document.querySelectorAll(
            '.product-form__input [name^="properties"]'
          );


        properties.forEach(
          (property) => {

            if (
              property.type === 'file'
            ) {

              if (
                !property.files ||
                property.files.length === 0 ||
                !property.files[0]
              ) {

                return;

              }


              formData.append(
                property.name,
                property.files[0]
              );


              return;

            }


            if (
              property.value == null ||
              property.value === ''
            ) {

              return;

            }


            formData.append(
              property.name,
              property.value
            );

          }
        );


        config.body =
          formData;


        /* ==================================================
           SHOPIFY AJAX ADD
           ================================================== */

        fetch(
          `${routes.cart_add_url}`,
          config
        )

          .then(
            (response) =>
              response.json()
          )


          .then(
            (response) => {


              /* ============================================
                 ERROR
                 ============================================ */

              if (
                response.status
              ) {

                publish(
                  PUB_SUB_EVENTS.cartError,
                  {

                    source:
                      'product-form-component',

                    productVariantId:
                      formData.get('id'),

                    errors:
                      response.errors ||
                      response.description,

                    message:
                      response.message

                  }
                );


                this.handleErrorMessage(
                  response.description
                );


                const soldOutMessage =
                  this.submitButton?.querySelector(
                    '.sold-out-message'
                  );


                if (
                  soldOutMessage &&
                  this.submitButton
                ) {

                  this.submitButton.setAttribute(
                    'aria-disabled',
                    true
                  );


                  if (
                    this.submitButtonText
                  ) {

                    this.submitButtonText.classList.add(
                      'hidden'
                    );

                  }


                  soldOutMessage.classList.remove(
                    'hidden'
                  );

                }


                this.error =
                  true;


                return;

              }


              /* ============================================
                 SUCCESS
                 ============================================ */

              this.error =
                false;


              /* ============================================
                 QUICK ADD SUCCESS
                 ============================================ */

              if (
                isQuickAdd
              ) {


                /*
                 * Update Shopify/theme cart state
                 */

                publish(
                  PUB_SUB_EVENTS.cartUpdate,
                  {

                    source:
                      'product-form-component',

                    productVariantId:
                      formData.get('id'),

                    cartData:
                      response

                  }
                );


                /*
                 * Close ONLY Quick Add.
                 *
                 * No redirect.
                 *
                 * No cart drawer.
                 */

                quickAddModal.hide(
                  true
                );


                /*
                 * Show premium notification
                 */

                this.showQuickAddNotification();


                /*
                 * Custom event for
                 * Universes RAW
                 */

                document.dispatchEvent(
                  new CustomEvent(
                    'universes:quick-add-success',
                    {

                      detail: {

                        variantId:
                          formData.get('id'),

                        response:
                          response

                      }

                    }
                  )
                );


                /*
                 * IMPORTANT:
                 *
                 * Stop here.
                 *
                 * Do NOT execute normal
                 * cart drawer behavior.
                 */

                return;

              }


              /* ============================================
                 NORMAL PRODUCT PAGE
                 ============================================ */

              if (!this.cart) {

                window.location =
                  `${window.routes?.cart_url}`;

                return;

              }


              /*
               * Update cart
               */

              publish(
                PUB_SUB_EVENTS.cartUpdate,
                {

                  source:
                    'product-form-component',

                  productVariantId:
                    formData.get('id'),

                  cartData:
                    response

                }
              );


              /*
               * Normal product page:
               * update/open cart drawer
               */

              if (
                this.cart &&
                typeof this.cart.renderContents ===
                  'function'
              ) {

                this.cart.renderContents(
                  response
                );

              }

            }
          )


          /* ==================================================
             ERROR CATCH
             ================================================== */

          .catch(
            (e) => {

              console.error(
                e
              );

            }
          )


          /* ==================================================
             FINALLY
             ================================================== */

          .finally(
            () => {


              /*
               * Main button
               */

              if (
                this.submitButton
              ) {

                this.submitButton.classList.remove(
                  'loading'
                );


                if (
                  !this.error
                ) {

                  this.submitButton.removeAttribute(
                    'aria-disabled'
                  );

                }


                const spinner =
                  this.submitButton.querySelector(
                    '.loading__spinner'
                  ) ||
                  this.submitButton.querySelector(
                    '.universes-quick-add__spinner'
                  );


                if (spinner) {

                  spinner.classList.add(
                    'hidden'
                  );

                }

              }


              /*
               * Sticky ATC
               */

              const productInfo =
                this.closest(
                  'product-info'
                );


              const sectionId =
                productInfo?.dataset.section ||
                productInfo?.dataset.originalSection;


              const stickyAddButton =
                sectionId
                  ? document.getElementById(
                      `StickyCart-ProductSubmitButton-${sectionId}`
                    )
                  : undefined;


              const stickyLoadingSpinner =
                stickyAddButton?.querySelector(
                  '.loading__spinner'
                );


              if (
                stickyAddButton &&
                stickyLoadingSpinner
              ) {

                stickyAddButton.classList.remove(
                  'loading'
                );


                stickyLoadingSpinner.classList.add(
                  'hidden'
                );

              }

            }
          );

      }


      /* ======================================================
         DISCONNECTED
         ====================================================== */

      disconnectedCallback() {

        try {

          this.cartErrorUnsubscriber?.();

          this._errorObserver?.disconnect();

        } catch (e) {

          // Silent

        }

      }


      /* ======================================================
         ERROR MESSAGE
         ====================================================== */

      handleErrorMessage(
        errorMessage = false
      ) {

        if (
          this.hideErrors
        ) {
          return;
        }


        this.errorMessageWrapper =
          this.errorMessageWrapper ||
          this.querySelector(
            '.product-form__error-message-wrapper'
          );


        if (
          !this.errorMessageWrapper
        ) {
          return;
        }


        this.errorMessage =
          this.errorMessage ||
          this.errorMessageWrapper.querySelector(
            '.product-form__error-message'
          );


        this.errorMessageWrapper.toggleAttribute(
          'hidden',
          !errorMessage
        );


        if (
          errorMessage
        ) {

          this.errorMessage.textContent =
            errorMessage;

        }

      }


      /* ======================================================
         TOGGLE SUBMIT BUTTON
         ====================================================== */

      toggleSubmitButton(
        disable = true,
        text
      ) {

        if (
          !this.submitButton
        ) {
          return;
        }


        if (
          disable
        ) {

          this.submitButton.setAttribute(
            'disabled',
            'disabled'
          );


          if (
            text &&
            this.submitButtonText
          ) {

            this.submitButtonText.textContent =
              text;

          }

        } else {

          this.submitButton.removeAttribute(
            'disabled'
          );


          if (
            this.submitButtonText
          ) {

            this.submitButtonText.textContent =
              window.variantStrings.addToCart;

          }

        }

      }


      /* ======================================================
         VARIANT ID
         ====================================================== */

      get variantIdInput() {

        return this.form.querySelector(
          '[name=id]'
        );

      }

    }
  );
}