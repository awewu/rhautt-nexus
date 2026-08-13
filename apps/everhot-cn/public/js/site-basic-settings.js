/* Runtime projection of Nexus website settings onto the static Everhot shell. */
(function () {
  var SITE_CODE = window.EVERHOT_SITE_CODE || 'everhot';
  var API_BASE = String(window.EVERHOT_API_BASE || '').replace(/\/$/, '');
  var SETTINGS_URL =
    API_BASE + '/api/v2/sites/' + encodeURIComponent(SITE_CODE) + '/basic-settings';

  function dataOf(payload) {
    return payload && payload.data ? payload.data : payload;
  }
  function section(settings, name) {
    return settings && settings[name] && typeof settings[name] === 'object' ? settings[name] : {};
  }
  function pick() {
    for (var i = 0; i < arguments.length; i += 1) {
      var value = arguments[i];
      if (value !== undefined && value !== null && String(value).trim() !== '')
        return String(value).trim();
    }
    return '';
  }
  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function isHomePage() {
    var path = window.location.pathname.replace(/\/+$/, '/') || '/';
    return path === '/' || path === '/index.html';
  }
  function runtimeUrl(value, baseUrl) {
    var src = pick(value);
    if (!src) return '';
    if (/^(https?:|data:|blob:)/i.test(src)) return src;
    if (API_BASE && /^(\/api\/v2\/|\/uploads\/)/i.test(src)) return API_BASE + src;
    try {
      return new URL(src, pick(baseUrl, window.location.origin)).href;
    } catch (_) {
      return src;
    }
  }
  function setText(selector, value) {
    if (!value) return;
    document.querySelectorAll(selector).forEach(function (node) {
      node.textContent = value;
    });
  }
  function setHtml(selector, value) {
    if (!value) return;
    document.querySelectorAll(selector).forEach(function (node) {
      node.innerHTML = value;
    });
  }
  function setAttr(selector, attr, value) {
    if (!value) return;
    document.querySelectorAll(selector).forEach(function (node) {
      node.setAttribute(attr, value);
    });
  }
  function setMeta(selector, value) {
    var node = document.querySelector(selector);
    if (node && value) node.setAttribute('content', value);
  }
  function setLink(selector, attr, value) {
    var node = document.querySelector(selector);
    if (node && value) node.setAttribute(attr || 'href', value);
  }

  function updateJsonLd(identity, organization, seo) {
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (node) {
      var parsed;
      try {
        parsed = JSON.parse(node.textContent || '{}');
      } catch (_) {
        return;
      }
      var siteName = pick(seo.ogSiteName, identity.siteName, seo.organizationName);
      var siteUrl = pick(identity.siteUrl, seo.canonicalBaseUrl);
      function patch(value) {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
          value.forEach(patch);
          return;
        }
        if (value['@type'] === 'WebSite') {
          if (siteName) value.name = siteName;
          if (siteUrl) value.url = siteUrl;
        }
        if (value['@type'] === 'Organization') {
          if (pick(seo.organizationName, identity.siteName))
            value.name = pick(seo.organizationName, identity.siteName);
          if (siteUrl) value.url = siteUrl;
          if (pick(seo.organizationLogo, identity.logoUrl))
            value.logo = runtimeUrl(pick(seo.organizationLogo, identity.logoUrl), siteUrl);
          if (pick(organization.parentOrganizationName)) {
            value.parentOrganization = {
              '@type': 'Organization',
              name: pick(organization.parentOrganizationName),
              url: pick(organization.parentOrganizationUrl, organization.operatorGroupUrl),
            };
          }
        }
        if (
          value.isPartOf &&
          typeof value.isPartOf === 'object' &&
          value.isPartOf['@type'] === 'WebSite'
        ) {
          if (siteName) value.isPartOf.name = siteName;
          if (siteUrl) value.isPartOf.url = siteUrl;
        }
        Object.keys(value).forEach(function (key) {
          patch(value[key]);
        });
      }
      patch(parsed);
      node.textContent = JSON.stringify(parsed);
    });
  }

  function applyHead(settings) {
    var identity = section(settings, 'identity');
    var seo = section(settings, 'seo');
    var organization = section(settings, 'organization');
    var homeTitle = pick(identity.siteTitle, seo.homeMetaTitle);
    var homeDescription = pick(seo.homeMetaDescription);
    var canonical = pick(seo.canonicalBaseUrl, identity.siteUrl);
    if (isHomePage()) {
      if (homeTitle) document.title = homeTitle;
      setMeta('meta[name="description"]', homeDescription);
      setMeta('meta[name="keywords"]', pick(seo.homeMetaKeywords));
      setMeta('meta[property="og:title"]', homeTitle);
      setMeta('meta[property="og:description"]', homeDescription);
      setMeta('meta[name="twitter:title"]', homeTitle);
      setMeta('meta[name="twitter:description"]', homeDescription);
      setLink('link[rel="canonical"]', 'href', canonical);
    }
    setMeta('meta[name="theme-color"]', pick(identity.themeColor));
    setMeta(
      'meta[property="og:site_name"]',
      pick(seo.ogSiteName, identity.siteName, seo.organizationName)
    );
    setMeta('meta[property="og:image"]', runtimeUrl(pick(seo.defaultOgImage), canonical));
    setMeta(
      'meta[name="twitter:image"]',
      runtimeUrl(pick(seo.defaultTwitterImage, seo.defaultOgImage), canonical)
    );
    setLink(
      'link[rel="icon"][sizes="16x16"]',
      'href',
      runtimeUrl(pick(identity.favicon16Url), canonical)
    );
    setLink(
      'link[rel="icon"][sizes="32x32"]',
      'href',
      runtimeUrl(pick(identity.favicon32Url), canonical)
    );
    setLink(
      'link[rel="icon"][sizes="any"]',
      'href',
      runtimeUrl(pick(identity.faviconIcoUrl), canonical)
    );
    setLink(
      'link[rel="apple-touch-icon"]',
      'href',
      runtimeUrl(pick(identity.appleTouchIconUrl), canonical)
    );
    updateJsonLd(identity, organization, seo);
  }

  function applyShell(settings) {
    var identity = section(settings, 'identity');
    var claims = section(settings, 'brandClaims');
    var organization = section(settings, 'organization');
    var contact = section(settings, 'contact');
    var dealerService = section(settings, 'dealerService');
    var legal = section(settings, 'legal');
    var canonical = pick(section(settings, 'seo').canonicalBaseUrl, identity.siteUrl);
    var brandCn = pick(identity.brandNameCn);
    var brandEn = pick(identity.brandNameEn);
    var logoAlt = pick(brandEn + (brandCn ? ' ' + brandCn : ''), identity.siteName);
    var logoUrl = runtimeUrl(pick(identity.logoUrl), canonical);
    var whiteLogoUrl = runtimeUrl(pick(identity.whiteLogoUrl, identity.logoUrl), canonical);

    setAttr('.ev-logo-img', 'src', logoUrl);
    setAttr('.ev-logo-img', 'alt', logoAlt);
    setAttr('.ev-aud-logo', 'src', whiteLogoUrl);
    setAttr('.ev-aud-logo', 'alt', logoAlt);
    setAttr('.ev-logo', 'aria-label', logoAlt);
    setText('.ev-logo-en, .logo-en', brandEn);
    setText('.ev-logo-cn, .logo-cn', brandCn);
    if (whiteLogoUrl) {
      document.querySelectorAll('.footer-brand .logo').forEach(function (node) {
        node.style.backgroundImage = 'url("' + whiteLogoUrl + '")';
      });
    }
    setText('.ev-util-locale', pick(identity.localeLabel));
    setAttr(
      '.ev-group-link, .ev-drawer-group',
      'href',
      pick(organization.groupSiteUrl, organization.operatorGroupUrl)
    );
    setText(
      '.ev-group-link',
      pick(organization.operatorGroupName) ? pick(organization.operatorGroupName) + ' ↗' : ''
    );
    setText('.ev-find-cta', pick(dealerService.dealerLocatorButtonText));

    var footerBrandLine = [
      [pick(claims.heroTitleLine1), pick(claims.heroTitleLine2)].filter(Boolean).join(' · '),
      pick(organization.parentBrandRelationText),
    ]
      .filter(Boolean)
      .map(esc)
      .join('<br>');
    setHtml('.footer-brand > p:not(.footer-slogan)', footerBrandLine);
    setText('.footer-slogan', pick(claims.heroSloganEn, claims.ctaSlogan));
    setText('.cta-slogan', pick(claims.ctaSlogan, claims.heroSloganEn));
    setText('.footer-bottom-inner > span', pick(legal.copyrightText));
    setAttr('.footer-legal a[href*="beian.miit.gov.cn"]', 'href', pick(legal.icpUrl));
    setText('.footer-legal a[href*="beian.miit.gov.cn"]', pick(legal.icpNumber));

    var hotline = pick(contact.customerServiceHotline);
    var telHref = pick(
      contact.customerServiceTelHref,
      hotline ? 'tel:' + hotline.replace(/[^\d+]/g, '') : ''
    );
    if (hotline) {
      document.querySelectorAll('a[href^="tel:"]').forEach(function (node) {
        node.href = telHref;
        if (/400|致电|客服|热线|电话/i.test(node.textContent || ''))
          node.textContent = '致电 ' + hotline;
      });
    }
  }

  function applyHome(settings) {
    if (!isHomePage() || document.querySelector('[data-hero-copy]')) return;
    var claims = section(settings, 'brandClaims');
    setText('.hero-eyebrow', pick(claims.heroEyebrow));
    setHtml(
      '.hero-content h1',
      [pick(claims.heroTitleLine1), pick(claims.heroTitleLine2)]
        .filter(Boolean)
        .map(esc)
        .join('<br>')
    );
    setText('.hero-slogan', pick(claims.heroSloganEn));
    setHtml('.hero-claim', esc(pick(claims.heroClaim)).replace(/\n/g, '<br>'));
    var actions = document.querySelectorAll('.hero-actions a');
    if (actions[0]) {
      if (pick(claims.primaryCtaText)) actions[0].textContent = pick(claims.primaryCtaText);
      if (pick(claims.primaryCtaHref)) actions[0].href = pick(claims.primaryCtaHref);
    }
    if (actions[1]) {
      if (pick(claims.secondaryCtaText)) actions[1].textContent = pick(claims.secondaryCtaText);
      if (pick(claims.secondaryCtaHref)) actions[1].href = pick(claims.secondaryCtaHref);
    }
  }

  function applySettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    window.EVERHOT_BASIC_SETTINGS = settings;
    applyHead(settings);
    applyShell(settings);
    applyHome(settings);
    document.documentElement.setAttribute('data-basic-settings-synced', 'true');
  }
  function loadSettings() {
    if (!window.fetch) return;
    fetch(SETTINGS_URL, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (payload) {
        applySettings(dataOf(payload));
      })
      .catch(function () {});
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', loadSettings);
  else loadSettings();
})();
