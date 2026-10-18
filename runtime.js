(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) { const p = typeof patch === 'function' ? patch(this.state) : patch; this.state = Object.assign({}, this.state, p); App.render(); }
    forceUpdate() { App.render(); }
  }
  window.DCLogic = DCLogic;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function lookup(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^'.*'$/.test(path)) return path.slice(1, -1);
    const parts = path.split('.');
    let v = scope;
    for (const k of parts) { if (v == null) return undefined; v = v[k]; }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, (_, p) => { const v = lookup(p, scope); return v == null ? '' : String(v); });
  }

  function renderNodes(tplParent, scope, outParent, svg) {
    for (const n of Array.from(tplParent.childNodes)) renderNode(n, scope, outParent, svg);
  }
  function renderNode(n, scope, out, svg) {
    if (n.nodeType === 3) { out.appendChild(document.createTextNode(interp(n.nodeValue, scope))); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (tag === 'helmet' || tag === 'script') return;
    if (tag === 'sc-for') {
      const m = WHOLE.exec(n.getAttribute('list') || '');
      const list = m ? lookup(m[1], scope) : [];
      const as = n.getAttribute('as') || 'item';
      (list || []).forEach((item, i) => {
        const s = Object.create(scope); s[as] = item; s.$index = i;
        renderNodes(n, s, out, svg);
      });
      return;
    }
    if (tag === 'sc-if') {
      const m = WHOLE.exec(n.getAttribute('value') || '');
      if (m && lookup(m[1], scope)) renderNodes(n, scope, out, svg);
      return;
    }
    const isSvg = svg || tag === 'svg';
    const el = isSvg ? document.createElementNS(SVGNS, n.tagName) : document.createElement(tag);
    for (const a of Array.from(n.attributes)) {
      const name = a.name;
      if (name.startsWith('hint-')) continue;
      const m = WHOLE.exec(a.value);
      if (/^on[a-z]/i.test(name)) {
        const fn = m ? lookup(m[1], scope) : null;
        if (typeof fn === 'function') {
          const ev = name.slice(2).toLowerCase();
          el.addEventListener(ev === 'change' ? 'input' : ev, (e) => { if (ev === 'click') { e.preventDefault(); } fn(e); });
        }
        continue;
      }
      let val = interp(a.value, scope);
      if (name === 'value' && tag === 'input') { el.value = val; el.setAttribute('value', val); continue; }
      el.setAttribute(name, val);
    }
    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      const mm = /^([A-Za-z0-9_]+)\.dc\.html$/.exec(href);
      if (mm) { el.setAttribute('href', '#' + mm[1]); }
      else if (/^https?:/.test(href)) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
    }
    renderNodes(n, scope, el, isSvg);
    out.appendChild(el);
  }

  const App = {
    screens: {}, cache: {}, current: null, inst: null,
    register(name, html, script) {
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      const Component = new Function('DCLogic', script + '\n;return Component;')(DCLogic);
      this.screens[name] = { tpl, Component };
    },
    go(name) {
      if (!this.screens[name]) name = 'OWelcome';
      if (this.inst && this.inst.componentWillUnmount) this.inst.componentWillUnmount();
      this.current = name;
      if (window.SGAudio) SGAudio.onNavigate(name);
      this.inst = new this.screens[name].Component({});
      this.render();
      document.getElementById('stage').scrollTop = 0;
      if (this.inst.componentDidMount) this.inst.componentDidMount();
      const t = this.screens[name].tpl.content.querySelector('title');
      document.title = 'Sneh Gurukul';
    },
    render() {
      const root = document.getElementById('screen');
      const act = document.activeElement;
      const focusId = act && act.id && root.contains(act) ? act.id : null;
      const sel = focusId && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null;
      const vals = this.inst.renderVals ? this.inst.renderVals() : {};
      const frag = document.createDocumentFragment();
      renderNodes(this.screens[this.current].tpl.content, vals, frag, false);
      root.replaceChildren(frag);
      if (window.SGAudio) { try { SGAudio.afterRender(this.current, root); } catch (e) { console.warn(e); } }
      if (focusId) { const e = document.getElementById(focusId); if (e) { e.focus(); if (sel && e.setSelectionRange) { try { e.setSelectionRange(sel[0], sel[1]); } catch (_) {} } } }
    }
  };
  window.App = App;

  function fit() {
    const s = Math.min(window.innerWidth / 390, window.innerHeight / 844);
    const box = document.getElementById('frame');
    box.style.transform = 'scale(' + s + ')';
    document.getElementById('stage').style.width = (390 * s) + 'px';
    document.getElementById('stage').style.height = (844 * s) + 'px';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', () => App.go(location.hash.slice(1) || 'OWelcome'));
  window.addEventListener('DOMContentLoaded', () => { fit(); App.go(location.hash.slice(1) || 'OWelcome'); });
})();
