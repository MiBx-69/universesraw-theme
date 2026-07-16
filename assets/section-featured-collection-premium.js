/**
 * Featured Collection (Premium)
 * Vanilla JS only — no external libraries.
 * Handles: scroll-in animation, quick add (AJAX cart), wishlist toggle.
 */
(function () {
  'use strict';

  function initScrollAnimations(root) {
    var cards = root.querySelectorAll('.fcp-card--animate');
    if (!cards.length) return;

    if (!('IntersectionObserver' in window)) {
      cards.forEach(function (card) {
        card.classList.add('fcp-card--in-view');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('fcp-card--in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    cards.forEach(function (card) {
      observer.observe(card);
    });
  }

  function setButtonState(button, state) {
    if (!button) return;
    var original = button.getAttribute('data-original-text') || button.textContent;
    button.setAttribute('data-original-text', original);

    if (state === 'loading') {
      button.disabled = true;
      button.textContent = 'Adding...';
    } else if (state === 'added') {
      button.textContent = 'Added';
      window.setTimeout(function () {
        button.disabled = false;
        button.textContent = original;
      }, 1400);
    } else if (state === 'error') {
      button.textContent = 'Error';
      window.setTimeout(function () {
        button.disabled = false;
        button.textContent = original;
      }, 1400);
    } else {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function quickAddToCart(button) {
    var variantId = button.getAttribute('data-variant-id');
    if (!variantId) return;

    setButtonState(button, 'loading');

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: variantId, quantity: 1 }]
      })
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(function (err) {
            throw new Error(err.description || 'Unable to add to cart');
          });
        }
        return response.json();
      })
      .then(function () {
        setButtonState(button, 'added');
        // Let the rest of the theme know the cart changed so cart drawers /
        // icon bubbles can refresh themselves without a full reload.
        document.documentElement.dispatchEvent(
          new CustomEvent('cart:refresh', { bubbles: true })
        );
        window.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));
      })
      .catch(function () {
        setButtonState(button, 'error');
      });
  }

  function initQuickAdd(root) {
    root.addEventListener('click', function (event) {
      var button = event.target.closest('[data-fcp-quick-add]');
      if (!button || button.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      quickAddToCart(button);
    });
  }

  function initSwatches(root) {
    root.addEventListener('click', function (event) {
      var swatch = event.target.closest('[data-swatch-value]');
      if (!swatch) return;
      event.preventDefault();
      event.stopPropagation();

      var group = swatch.closest('.fcp-card__swatches');
      if (!group) return;

      group.querySelectorAll('.fcp-card__swatch--active').forEach(function (el) {
        el.classList.remove('fcp-card__swatch--active');
      });
      swatch.classList.add('fcp-card__swatch--active');
    });
  }

  function initWishlist(root) {
    root.addEventListener('click', function (event) {
      var button = event.target.closest('[data-fcp-wishlist]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();

      var productId = button.getAttribute('data-product-id');
      var isActive = button.classList.toggle('is-active');

      // Dispatch an event so wishlist apps/integrations can hook in
      // without this section depending on any specific app.
      document.documentElement.dispatchEvent(
        new CustomEvent('fcp:wishlist-toggle', {
          bubbles: true,
          detail: { productId: productId, active: isActive }
        })
      );
    });
  }

  function initSection(section) {
    initScrollAnimations(section);
    initQuickAdd(section);
    initSwatches(section);
    initWishlist(section);
  }

  function initAll() {
    document.querySelectorAll('.fcp').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Re-init when the section is added/edited live in the Theme Editor.
  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.fcp');
    if (section) initSection(section);
  });
})();
