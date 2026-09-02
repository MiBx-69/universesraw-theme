if (!customElements.get('product-info')) {
  customElements.define(
    'product-info',
    class ProductInfo extends HTMLElement {
      quantityInput = undefined;
      quantityForm = undefined;
      stickyQuantityContainer = undefined;
      stickyQuantityInput = undefined;
      isSyncingQuantity = false;
      isSyncingVariant = false;
      onVariantChangeUnsubscriber = undefined;
      cartUpdateUnsubscriber = undefined;
      variantChangeUnsubscriber = undefined;
      abortController = undefined;
      pendingRequestUrl = null;
      preProcessHtmlCallbacks = [];
      postProcessHtmlCallbacks = [];
      includeVariantInUrl = false;

      constructor() {
        super();
        this.quantityInput = this.querySelector('.quantity__input');
        this.stickyQuantityContainer = document.querySelector('.sticky-cart__quantity');
        this.stickyQuantityInput = this.stickyQuantityContainer?.querySelector('.quantity__input') || undefined;
        this.includeVariantInUrl = new URLSearchParams(window.location.search).has('variant');
        this.setRecentlyViewed();
      }

      connectedCallback() {
        this.initializeProductSwapUtility();
        requestAnimationFrame(() => updateProductShareButtonWidth());
        this.onVariantChangeUnsubscriber = subscribe(
          PUB_SUB_EVENTS.optionValueSelectionChange,
          this.handleOptionValueChange.bind(this)
        );
        this.initQuantityHandlers();
        this.initStickyQuantityHandlers();
        this.initVariantSyncHandlers();
        this.classList.add('initialized');
        this.dispatchEvent(new CustomEvent('product-info:loaded', { bubbles: true }));
      }

      addPreProcessCallback(callback) {
        this.preProcessHtmlCallbacks.push(callback);
      }

      initVariantSyncHandlers() {
        this.variantChangeUnsubscriber = subscribe(
          PUB_SUB_EVENTS.variantChange,
          this.handleVariantChangeForSticky.bind(this)
        );
      }

      handleVariantChangeForSticky({ data }) {
        if (data.sectionId !== this.sectionId) return;
        if (this.isSyncingVariant) return;
        this.isSyncingVariant = true;
        try {
          const stickyVariantSelects = document.querySelector('variant-selects[data-context^="sticky"]');
          if (!stickyVariantSelects) return;
          const mainVariantSelects = this.variantSelectors;
          if (!mainVariantSelects) return;
          const mainSelectedOptions = mainVariantSelects.querySelectorAll('select option[selected], fieldset input:checked');
          mainSelectedOptions.forEach((mainOption) => {
            const optionValueId = mainOption.dataset.optionValueId;
            if (!optionValueId) return;
            const stickyOption = stickyVariantSelects.querySelector(`[data-option-value-id="${optionValueId}"]`);
            if (!stickyOption) return;
            if (stickyOption.tagName === 'INPUT' && stickyOption.type === 'radio') {
              stickyVariantSelects.querySelectorAll('input[type="radio"]').forEach(input => input.classList.remove('checked'));
              stickyVariantSelects.querySelectorAll('label').forEach(label => label.classList.remove('checked'));
              if (mainOption) {
                mainVariantSelects.querySelectorAll('input[type="radio"]').forEach(input => input.classList.remove('checked'));
                mainVariantSelects.querySelectorAll('label').forEach(label => label.classList.remove('checked'));
              }
              if (!stickyOption.checked) {
                setTimeout(() => {
                  stickyOption.classList.add('checked');
                  stickyOption.nextElementSibling.classList.add('checked');
                  if (mainOption) {
                    mainOption.classList.add('checked');
                    mainOption.nextElementSibling.classList.add('checked');
                  }
                }, 10);
                const selectedValueSpan = stickyOption.closest('.product-form__input')?.querySelector('[data-selected-value]');
                if (selectedValueSpan) selectedValueSpan.innerHTML = stickyOption.value;
              }
            } else if (stickyOption.tagName === 'OPTION') {
              const select = stickyOption.closest('select');
              if (select && select.value !== stickyOption.value) {
                Array.from(select.options).forEach(opt => opt.removeAttribute('selected'));
                stickyOption.setAttribute('selected', 'selected');
                select.value = stickyOption.value;
                const selectedValueSpan = select.closest('.product-form__input')?.querySelector('[data-selected-value]');
                if (selectedValueSpan) selectedValueSpan.textContent = stickyOption.value;
              }
            }
          });
          this.updateStickyButtonState(data.variant);
        } finally {
          setTimeout(() => { this.isSyncingVariant = false; }, 10);
        }
      }

      updateStickyButtonState(variant) {
        const stickyButton = document.querySelector('.sticky-cart__button [name="add"]');
        if (!stickyButton) return;
        if (variant && variant.available) stickyButton.removeAttribute('disabled');
        else stickyButton.setAttribute('disabled', 'disabled');
        const stickyVariantInput = document.querySelector('#product-form-sticky-' + this.dataset.section + ' input[name="id"]');
        if (stickyVariantInput && variant) stickyVariantInput.value = variant.id;
        try { this.updateStickyThumbnail(variant); } catch (e) {}
      }

      initQuantityHandlers() {
        if (!this.quantityInput) return;
        this.quantityForm = this.querySelector('.product-form__quantity');
        if (!this.quantityForm) return;
        this.setQuantityBoundries();
        if (!this.dataset.originalSection) {
          this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, this.fetchQuantityRules.bind(this));
        }
      }

      initStickyQuantityHandlers() {
        if (!this.stickyQuantityInput || !this.quantityInput) return;
        this.syncStickyFromMain();
        const onStickyChange = () => this.syncMainFromSticky();
        this.stickyQuantityInput.addEventListener('input', onStickyChange);
        this.stickyQuantityInput.addEventListener('change', onStickyChange);
        const onMainChange = () => this.syncStickyFromMain();
        this.quantityInput.addEventListener('input', onMainChange);
        this.quantityInput.addEventListener('change', onMainChange);
        this.syncStickyConstraintsFromMain();
      }

      syncMainFromSticky() {
        if (!this.stickyQuantityInput || !this.quantityInput || this.isSyncingQuantity) return;
        this.isSyncingQuantity = true;
        try {
          this.quantityInput.value = this.stickyQuantityInput.value;
          this.quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
          publish?.(PUB_SUB_EVENTS.quantityUpdate, undefined);
        } finally { this.isSyncingQuantity = false; }
      }

      syncStickyFromMain() {
        if (!this.stickyQuantityInput || !this.quantityInput || this.isSyncingQuantity) return;
        this.isSyncingQuantity = true;
        try {
          this.stickyQuantityInput.value = this.quantityInput.value;
          this.syncStickyConstraintsFromMain();
        } finally { this.isSyncingQuantity = false; }
      }

      syncStickyConstraintsFromMain() {
        if (!this.stickyQuantityInput || !this.quantityInput) return;
        ['data-cart-quantity', 'data-min', 'data-max', 'step', 'min', 'max'].forEach((attr) => {
          const val = this.quantityInput.getAttribute(attr);
          if (val !== null) this.stickyQuantityInput.setAttribute(attr, val);
          else this.stickyQuantityInput.removeAttribute(attr);
        });
      }

      disconnectedCallback() {
        this.onVariantChangeUnsubscriber?.();
        this.cartUpdateUnsubscriber?.();
        this.variantChangeUnsubscriber?.();
      }

      initializeProductSwapUtility() {
        this.preProcessHtmlCallbacks.push((html) => html.querySelectorAll('.scroll-trigger').forEach((element) => element.classList.add('scroll-trigger--cancel')));
        this.postProcessHtmlCallbacks.push(() => {
          window?.Shopify?.PaymentButton?.init();
          window?.ProductModel?.loadShopifyXR();
          requestAnimationFrame(() => updateProductShareButtonWidth());
        });
      }

      handleOptionValueChange({ data: { event, target, selectedOptionValues } }) {
        if (!this.contains(event.target)) return;
        if (event?.isTrusted) this.includeVariantInUrl = true;
        this.resetProductFormState();
        const productUrl = target.dataset.productUrl || this.pendingRequestUrl || this.dataset.url;
        this.pendingRequestUrl = productUrl;
        const shouldSwapProduct = this.dataset.url !== productUrl;
        const shouldFetchFullPage = this.dataset.updateUrl === 'true' && shouldSwapProduct;
        const isStickyChanged = event.target.closest('variant-selects');
        this.renderProductInfo({
          requestUrl: this.buildRequestUrlWithParams(productUrl, selectedOptionValues, shouldFetchFullPage),
          targetId: target.id,
          callback: shouldSwapProduct ? this.handleSwapProduct(productUrl, shouldFetchFullPage) : this.handleUpdateProductInfo(productUrl, event.target),
          isStickyChanged,
        });
      }

      resetProductFormState() {
        const productForm = this.productForm;
        productForm?.toggleSubmitButton(true);
        productForm?.handleErrorMessage();
      }

      handleSwapProduct(productUrl, updateFullPage) {
        return (html) => {
          this.productModal?.remove();
          const selector = updateFullPage ? "product-info[id^='MainProduct']" : 'product-info';
          const variant = this.getSelectedVariant(html.querySelector(selector));
          this.updateURL(productUrl, variant?.id);
          if (updateFullPage) {
            document.querySelector('head title').innerHTML = html.querySelector('head title').innerHTML;
            HTMLUpdateUtility.viewTransition(document.querySelector('main'), html.querySelector('main'), this.preProcessHtmlCallbacks, this.postProcessHtmlCallbacks);
          } else {
            HTMLUpdateUtility.viewTransition(this, html.querySelector('product-info'), this.preProcessHtmlCallbacks, this.postProcessHtmlCallbacks);
          }
        };
      }

      renderProductInfo({ requestUrl, targetId, callback, isStickyChanged = false }) {
        this.abortController?.abort();
        this.abortController = new AbortController();
        fetch(requestUrl, { signal: this.abortController.signal })
          .then((response) => response.text())
          .then((responseText) => {
            this.pendingRequestUrl = null;
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            callback(html);
          })
          .then(() => { if (!isStickyChanged) document.querySelector(`#${targetId}`)?.focus(); })
          .catch((error) => { if (error.name !== 'AbortError') console.error(error); });
      }

      getSelectedVariant(productInfoNode) {
        const selectedVariant = productInfoNode?.querySelector('variant-selects [data-selected-variant]')?.innerHTML;
        return !!selectedVariant ? JSON.parse(selectedVariant) : null;
      }

      buildRequestUrlWithParams(url, optionValues, shouldFetchFullPage = false) {
        const params = [];
        !shouldFetchFullPage && params.push(`section_id=${this.sectionId}`);
        if (optionValues.length) params.push(`option_values=${optionValues.join(',')}`);
        return `${url}?${params.join('&')}`;
      }

      updateOptionValues(html) {
        const variantSelects = html.querySelector('variant-selects');
        if (variantSelects) HTMLUpdateUtility.viewTransition(this.variantSelectors, variantSelects, this.preProcessHtmlCallbacks);
      }

      handleUpdateProductInfo(productUrl, target) {
        return (html) => {
          const variant = this.getSelectedVariant(html);
          this.pickupAvailability?.update(variant);
          this.updateOptionValues(html);
          this.updateURL(productUrl, variant?.id);
          this.updateVariantInputs(variant?.id);
          if (!variant) { this.setUnavailable(); return; }
          this.updateMedia(html, variant?.featured_media?.id);
          publish(PUB_SUB_EVENTS.variantChange, { data: { sectionId: this.sectionId, html, variant } });
          this.updateQuantityRules(this.sectionId, html);
          this.productForm?.toggleSubmitButton(html.getElementById(`ProductSubmitButton-${this.sectionId}`)?.hasAttribute('disabled') ?? true, window.variantStrings.soldOut);
          this.updateAddButtonText(this);
        };
      }

      updateVariantInputs(variantId) {
        if (!this.productForm || !variantId) return;
        const productForms = this.productForm.querySelectorAll('form[data-type="add-to-cart-form"], form');
        productForms.forEach((productForm) => {
          const input = productForm.querySelector('input[name="id"].product-variant-id, input[name="id"]');
          if (!input) return;
          input.value = String(variantId);
          input.setAttribute('value', String(variantId));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        this.querySelectorAll('input[name="id"].product-variant-id').forEach((input) => {
          if (input.closest('product-info') === this) {
            input.value = String(variantId);
            input.setAttribute('value', String(variantId));
          }
        });
      }

      updateURL(url, variantId) {
        const shouldAppendVariant = this.includeVariantInUrl && variantId;
        this.querySelector('share-button')?.updateUrl(`${window.shopUrl}${url}${shouldAppendVariant ? `?variant=${variantId}` : ''}`);
        if (this.dataset.updateUrl === 'false') return;
        window.history.replaceState({}, '', `${url}${shouldAppendVariant ? `?variant=${variantId}` : ''}`);
      }

      setUnavailable() { this.productForm?.toggleSubmitButton(true, window.variantStrings.unavailable); }
      updateMedia(html, variantFeaturedMediaId) {
        if (!variantFeaturedMediaId) return;
        this.querySelector('media-gallery')?.setActiveMedia?.(`${this.dataset.section}-${variantFeaturedMediaId}`, true);
      }
      updateStickyThumbnail(variant) {
        if (!variant) return;
        const sectionId = this.sectionId;
        const stickyScope = document.querySelector(`sticky-atc[data-sticky-section-id="${sectionId}"]`) || document.querySelector('sticky-atc');
        if (!stickyScope) return;
        const img = stickyScope.querySelector('.sticky-atc__media img');
        if (!img) return;
        const srcCandidate = variant?.featured_media?.preview_image?.src || variant?.featured_media?.src;
        if (!srcCandidate) return;
        const url = srcCandidate.includes('?') ? `${srcCandidate}&width=64` : `${srcCandidate}?width=64`;
        img.src = url;
        if (img.hasAttribute('srcset')) img.removeAttribute('srcset');
        img.setAttribute('sizes', '64px');
        img.setAttribute('width', '64');
        img.setAttribute('height', '64');
        img.loading = 'lazy';
      }

      setQuantityBoundries() { if (this.quantityInput) { this.quantityInput.min = this.quantityInput.dataset.min || 1; } }
      fetchQuantityRules() {}
      updateQuantityRules() {}
      setRecentlyViewed() {}
      updateAddButtonText() {}
      handleHotStock() {}
      handleBackInStockAlert() {}
      get productForm() { return this.querySelector('product-form'); }
      get pickupAvailability() { return this.querySelector('pickup-availability'); }
      get variantSelectors() { return this.querySelector('variant-selects'); }
      get sectionId() { return this.dataset.originalSection || this.dataset.section; }
    }
  );
}