(function () {
  'use strict';

  var PERSONAS = {
    sales: {
      label: 'Derek Keller (Sales)',
      initials: 'DK',
      email: 'derek.keller@netapp.com',
      photo: 'images/avatar-placeholder.svg',
      defaultPage: 'sales-dashboard.html'
    },
    'deal-desk': {
      label: 'Laura Ramirez (Deal Desk)',
      initials: 'LR',
      email: 'laura.ramirez@netapp.com',
      photo: 'images/laura-ramirez.png',
      defaultPage: 'index.html'
    }
  };

  var activePersona = '';

  function getPersonaFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get('persona') || '';
    } catch (e) {
      return '';
    }
  }

  function getRedirectTarget() {
    try {
      return new URLSearchParams(window.location.search).get('redirect') || '';
    } catch (e) {
      return '';
    }
  }

  function applyPersona(persona) {
    activePersona = persona;
    var cfg = PERSONAS[persona];
    var badge = document.getElementById('login-persona-badge');
    var icon = document.getElementById('login-persona-badge-icon');
    var text = document.getElementById('login-persona-badge-text');
    var emailInput = document.getElementById('login-email');

    if (cfg && badge && icon && text) {
      if (cfg.photo) {
        icon.innerHTML = '<img src="' + cfg.photo + '" alt="' + cfg.label + '" class="login-persona-badge-photo">';
      } else {
        icon.innerHTML = '';
        icon.textContent = cfg.initials;
      }
      text.textContent = 'Signing in as ' + cfg.label;
      badge.hidden = false;
      if (emailInput) emailInput.value = cfg.email;
      var passInput = document.getElementById('login-password');
      if (passInput) passInput.value = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
    } else if (badge) {
      badge.hidden = true;
    }
  }

  function handleSubmit(e) {
    e.preventDefault();

    var submitBtn = document.getElementById('login-submit');
    submitBtn.textContent = 'Signing in...';
    submitBtn.classList.add('login-submit--loading');
    submitBtn.disabled = true;

    var persona = activePersona || getPersonaFromUrl() || 'sales';
    var redirect = getRedirectTarget();

    setTimeout(function () {
      try { localStorage.setItem('appPersona', persona); } catch (err) {}

      var cfg = PERSONAS[persona];
      var targetPage = redirect || (cfg ? cfg.defaultPage : 'sales-dashboard.html');
      window.location.href = targetPage + (targetPage.indexOf('?') === -1 ? '?' : '&') + 'persona=' + encodeURIComponent(persona);
    }, 300);
  }

  function togglePassword() {
    var input = document.getElementById('login-password');
    if (!input) return;
    var isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    var btn = document.getElementById('login-password-toggle');
    if (btn) btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  }

  function init() {
    var persona = getPersonaFromUrl();

    var select = document.getElementById('login-persona-select');
    if (select) {
      if (persona && PERSONAS[persona]) {
        select.value = persona;
      }
      select.addEventListener('change', function () {
        var next = select.value;
        if (next === 'customer') {
          try { localStorage.setItem('appPersona', 'customer'); } catch (e) {}
          window.location.href = 'customer-sizing.html?persona=customer';
          return;
        }
        applyPersona(next);
      });
    }

    if (persona && PERSONAS[persona]) {
      applyPersona(persona);
    }

    document.getElementById('login-form').addEventListener('submit', handleSubmit);
    document.getElementById('login-password-toggle').addEventListener('click', togglePassword);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
