if (!customElements.get('quick-add-modal')) {
  customElements.define(
    'quick-add-modal',
    class QuickAddModal extends ModalDialog {
      constructor() {
        super();

        this.modalContent = this.querySelector('#QuickStandardModal');

        this.addEventListener('product-info:loaded', ({ target }) => {
          if (target && typeof target.addPreProcessCallback === 'function') {
            target.addPreProcessCallback(this.preprocessHTML.bind(this));
          }
        });
      }

      hide(preventFocus = false) {
        const cartNotification = document.querySelector('cart-drawer');

        if (cartNotification && this.openedBy) {
          cartNotification.setActiveElement(this.openedBy);
        }

        setTimeout(() => {
          if (this.modalContent) {
            this.modalContent.innerHTML = '';
          }
        }, 500);

        if (preventFocus) {
          this.openedBy = null;
        }

        super.hide();
      }

      show(opener) {
        if (!opener) return;

        const productUrl = opener.getAttribute('data-product-url');

        if (!productUrl) {
          console.warn('Quick Add: product URL is missing.');
          return;
        }

        const spinner = opener.querySelector('.loading__spinner');

        opener.setAttribute('aria-disabled', 'true');
        opener.classList.add('loading');

        if (spinner) {
          spinner.classList.remove('hidden');
        }

        const quickAddUrl =
          productUrl.split('?')[0] + '?view=quick_add';

        fetch(quickAddUrl, {
          method: 'GET',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(
                `Quick Add request failed: ${response.status}`
              );
            }

            return response.text();
          })
          .then((responseText) => {
            const responseHTML = new DOMParser().parseFromString(
              responseText,
              'text/html'
            );

            const productElement =
              responseHTML.querySelector('product-info');

            if (!productElement) {
              throw new Error(
                'Quick Add: product-info element was not found.'
              );
            }

            this.preprocessHTML(productElement);

            if (!this.modalContent) {
              throw new Error(
                'Quick Add: #QuickStandardModal was not found.'
              );
            }

            HTMLUpdateUtility.setInnerHTML(
              this.modalContent,
              productElement.outerHTML
            );

            /*
             * Reinitialize product-related functionality
             * inside the dynamically loaded Quick Add content.
             */

            if (
              typeof window.initProductSubtotals === 'function'
            ) {
              window.initProductSubtotals(this.modalContent);
            }

            if (
              window.Shopify &&
              Shopify.PaymentButton
            ) {
              Shopify.PaymentButton.init();
            }

            if (
              window.ProductModel &&
              typeof window.ProductModel.loadShopifyXR === 'function'
            ) {
              window.ProductModel.loadShopifyXR();
            }

            /*
             * Ella product-info / variant picker initialization
             * is triggered by the dynamically inserted product-info
             * element.
             */

            super.show(opener);
          })
          .catch((error) => {
            console.error(
              'Universes RAW Quick Add error:',
              error
            );

            /*
             * Keep the storefront usable if Quick Add fails.
             * The product page remains available as a fallback.
             */

            if (this.modalContent) {
              this.modalContent.innerHTML = `
                <div class="quick-add-error" role="alert">
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

              super.show(opener);
            }
          })
          .finally(() => {
            opener.removeAttribute('aria-disabled');
            opener.classList.remove('loading');

            if (spinner) {
              spinner.classList.add('hidden');
            }
          });
      }

      preprocessHTML(productElement) {
        if (!productElement) return;

        /*
         * Copy product color/gradient classes to the modal.
         */

        productElement.classList.forEach((classApplied) => {
          if (
            classApplied.startsWith('color-') ||
            classApplied === 'gradient'
          ) {
            this.modalContent.classList.add(classApplied);
          }
        });

        /*
         * Prevent duplicate IDs when the product section
         * is inserted into the Quick Add modal.
         */

        this.preventDuplicatedIDs(productElement);

        /*
         * Remove product-page-only elements.
         */

        this.removeDOMElements(productElement);

        /*
         * Keep gallery accessibility structure safe.
         */

        this.removeGalleryListSemantic(productElement);

        /*
         * Prevent changing the browser URL when variants
         * are selected inside Quick Add.
         */

        this.preventVariantURLSwitching(productElement);
      }

      preventVariantURLSwitching(productElement) {
        productElement.setAttribute(
          'data-update-url',
          'false'
        );
      }

      removeDOMElements(productElement) {
        /*
         * Pickup availability
         */

        const pickupAvailability =
          productElement.querySelector(
            'pickup-availability'
          );

        if (pickupAvailability) {
          pickupAvailability.remove();
        }

        /*
         * Share button
         */

        const shareButton =
          productElement.querySelector('share-button');

        if (shareButton) {
          shareButton.remove();
        }

        /*
         * Product modal
         */

        const productModal =
          productElement.querySelector('product-modal');

        if (productModal) {
          productModal.remove();
        }

        /*
         * Nested modal dialogs
         */

        const modalDialogs =
          productElement.querySelectorAll('modal-dialog');

        if (modalDialogs.length) {
          modalDialogs.forEach((modal) => {
            modal.remove();
          });
        }

        /*
         * Side drawer openers
         */

        const sideDrawerOpeners =
          productElement.querySelectorAll(
            'side-drawer-opener'
          );

        if (sideDrawerOpeners.length) {
          sideDrawerOpeners.forEach((button) => {
            if (
              !button.classList.contains(
                'product-popup-modal__opener--keep'
              )
            ) {
              button.remove();
            }
          });
        }

        /*
         * Side drawers
         */

        const sideDrawers =
          productElement.querySelectorAll(
            'side-drawer'
          );

        if (sideDrawers.length) {
          sideDrawers.forEach((drawer) => {
            if (
              !drawer.classList.contains(
                'product-popup-modal__drawer--keep'
              )
            ) {
              drawer.remove();
            }
          });
        }
      }

      preventDuplicatedIDs(productElement) {
        const sectionId =
          productElement.dataset.section;

        if (!sectionId) return;

        const oldId = sectionId;
        const newId = `quickadd-${sectionId}`;

        /*
         * Replace section ID references inside the HTML.
         */

        productElement.innerHTML =
          productElement.innerHTML.replaceAll(
            oldId,
            newId
          );

        /*
         * Replace section ID references inside attributes.
         */

        Array.from(productElement.attributes).forEach(
          (attribute) => {
            if (attribute.value.includes(oldId)) {
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

      removeGalleryListSemantic(productElement) {
        const galleryList =
          productElement.querySelector(
            '[id^="Slider-Gallery"]'
          );

        if (!galleryList) return;

        galleryList.setAttribute(
          'role',
          'presentation'
        );

        galleryList
          .querySelectorAll('[id^="Slide-"]')
          .forEach((li) => {
            li.setAttribute(
              'role',
              'presentation'
            );
          });
      }
    }
  );
}