if (!customElements.get('product-form-component')) {
  customElements.define(
    'product-form-component',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.init();
      }

      init() {
        this.form = this.querySelector('form');

        if (!this.form) return;

        this.variantIdInput.disabled = false;

        this.form.addEventListener(
          'submit',
          this.onSubmitHandler.bind(this)
        );

        this.cart = document.querySelector('cart-drawer');

        this.submitButton =
          this.form?.querySelector('.add-to-cart-button') ||
          this.form?.querySelector('.universes-quick-add__submit');

        this.submitButtonText = this.submitButton
          ? this.submitButton.querySelector('span')
          : null;

        this.checkbox =
          this.form?.querySelector('[id^="agree_condition-"]');

        this.buyItNowButton =
          this.form?.querySelector('.shopify-payment-button');

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
              !mainErrorWrapper.hasAttribute('hidden');

            const errorMessage =
              mainErrorWrapper.querySelector(
                '.product-form__error-message'
              )?.textContent;

            stickyErrorWrapper.toggleAttribute(
              'hidden',
              !isVisible || !errorMessage
            );

            if (isVisible && errorMessage) {
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
            new MutationObserver(syncFromMain);

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
         AGREEMENT CHECKBOX
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
         SUBMIT
         ====================================================== */

      onSubmitHandler(evt) {

        evt.preventDefault();

        if (
          this.submitButton?.getAttribute(
            'aria-disabled'
          ) === 'true'
        ) {
          return;
        }


        /* Detect Quick Add */

        const quickAddModal =
          this.closest('quick-add-modal');

        const isQuickAdd =
          !!quickAddModal;


        this.handleErrorMessage();


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
            spinner.classList.remove('hidden');
          }
        }


        /* ==================================================
           STICKY BUTTON LOADING
           ================================================== */

        const productInfo =
          this.closest('product-info');

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
          fetchConfig('javascript');

        config.headers[
          'X-Requested-With'
        ] = 'XMLHttpRequest';

        delete config.headers[
          'Content-Type'
        ];


        const formData =
          new FormData(this.form);


        /* ==================================================
           CART SECTION DATA
           ================================================== */

        if (this.cart) {

          formData.append(
            'sections',
            this.cart
              .getSectionsToRender()
              .map(
                (section) => section.id
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

            if (property.type === 'file') {

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


        config.body = formData;


        /* ==================================================
           ADD TO CART
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

              if (response.status) {

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

                  if (this.submitButtonText) {
                    this.submitButtonText.classList.add(
                      'hidden'
                    );
                  }

                  soldOutMessage.classList.remove(
                    'hidden'
                  );
                }

                this.error = true;

                return;
              }


              /* ============================================
                 SUCCESS
                 ============================================ */

              this.error = false;


              /* --------------------------------------------
                 QUICK ADD
                 -------------------------------------------- */

              if (isQuickAdd) {

                /*
                 * Tell the rest of the theme that
                 * the cart changed.
                 *
                 * This allows cart counters/badges
                 * to update without opening the drawer.
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
                 * Close ONLY the Quick Add popup.
                 *
                 * Do NOT:
                 * - redirect to /cart
                 * - open cart drawer
                 * - render cart drawer contents
                 */

                quickAddModal.hide(true);


                /*
                 * Optional success feedback
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


                return;
              }


              /* --------------------------------------------
                 NORMAL PRODUCT PAGE
                 -------------------------------------------- */

              if (!this.cart) {

                window.location =
                  `${window.routes?.cart_url}`;

                return;
              }


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
              console.error(e);
            }
          )


          /* ==================================================
             FINALLY
             ================================================== */

          .finally(
            () => {

              if (this.submitButton) {

                this.submitButton.classList.remove(
                  'loading'
                );

                if (!this.error) {

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


              /* Sticky ATC */

              const productInfo =
                this.closest('product-info');

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

        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper ||
          this.querySelector(
            '.product-form__error-message-wrapper'
          );

        if (!this.errorMessageWrapper) return;

        this.errorMessage =
          this.errorMessage ||
          this.errorMessageWrapper.querySelector(
            '.product-form__error-message'
          );

        this.errorMessageWrapper.toggleAttribute(
          'hidden',
          !errorMessage
        );

        if (errorMessage) {

          this.errorMessage.textContent =
            errorMessage;
        }
      }


      /* ======================================================
         TOGGLE SUBMIT
         ====================================================== */

      toggleSubmitButton(
        disable = true,
        text
      ) {

        if (!this.submitButton) return;

        if (disable) {

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

          if (this.submitButtonText) {

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