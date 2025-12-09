// frontend/static/js/autocomplete.js

export class AutocompleteHandler {
  constructor({ input, dataset, onSelect, maxSuggestions = 10 }) {
    this.input = document.querySelector(input);
    this.dataset = dataset || [];
    this.onSelect = onSelect;
    this.maxSuggestions = maxSuggestions;
    this.currentFocus = -1;
    
    if (!this.input) {
      throw new Error(`Input element not found: ${input}`);
    }

    this.input.autocompleteInstance = this;
    this.createListElement();
    this.attachEventListeners();
  }

  createListElement() {
    // Remove existing if any
    const existing = this.input.parentNode.querySelector('.autocomplete-dropdown-list');
    if (existing) existing.remove();

    this.list = document.createElement('ul');
    this.list.className = 'autocomplete-dropdown-list';
    this.list.id = `autocomplete-${this.input.id}`;
    
    this.list.setAttribute('style', `
      position: absolute !important;
      top: 100% !important;
      left: 0 !important;
      width: 100% !important;
      z-index: 99999 !important;
      background: white !important;
      border: 2px solid #4CAF50 !important;
      border-top: none !important;
      border-radius: 0 0 4px 4px !important;
      margin: 0 !important;
      padding: 0 !important;
      list-style: none !important;
      max-height: 250px !important;
      overflow-y: auto !important;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
      display: none !important;
    `);
    
    this.input.parentNode.appendChild(this.list);
    
    // Force parent to be positioned
    const parent = this.input.parentNode;
    if (window.getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
  }

  attachEventListeners() {
    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.input.addEventListener('focus', () => this.showSuggestions());
    
    // Hide on blur with delay to allow clicking suggestions
    this.input.addEventListener('blur', () => {
      setTimeout(() => this.close(), 200);
    });
  }

  handleInput() {
    const value = this.input.value.trim();
    
    if (value.length === 0) {
      this.renderSuggestions(this.dataset.slice(0, this.maxSuggestions));
      return;
    }
    
    const searchLower = value.toLowerCase();
    const filtered = this.dataset
      .filter(item => item.toLowerCase().includes(searchLower))
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        // Exact match first
        if (aLower === searchLower) return -1;
        if (bLower === searchLower) return 1;
        
        // Then starts with
        if (aLower.startsWith(searchLower) && !bLower.startsWith(searchLower)) return -1;
        if (!aLower.startsWith(searchLower) && bLower.startsWith(searchLower)) return 1;
        
        // Then alphabetical
        return a.localeCompare(b);
      })
      .slice(0, this.maxSuggestions);
    
    this.renderSuggestions(filtered);
  }

  renderSuggestions(items) {
    if (!items || items.length === 0) {
      this.list.innerHTML = '<li style="padding: 10px; color: #999;">No matches found</li>';
      this.list.setAttribute('style', this.list.getAttribute('style').replace('display: none', 'display: block'));
      return;
    }

    this.list.innerHTML = items.map((item, index) => `
      <li data-index="${index}" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #ccc; background: white;">${item}</li>
    `).join('');

    // Add click handlers
    this.list.querySelectorAll('li').forEach((li, index) => {
      li.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur
        this.selectItem(index);
      });
      
      li.addEventListener('mouseover', () => {
        this.setActiveItem(index);
      });
    });

    this.list.setAttribute('style', this.list.getAttribute('style').replace('display: none', 'display: block'));
    this.currentFocus = -1;
  }

  handleKeyDown(e) {
    const items = this.list.querySelectorAll('li[data-index]');
    if (!items.length) return;

    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.currentFocus = (this.currentFocus + 1) % items.length;
        this.setActiveItem(this.currentFocus);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.currentFocus = (this.currentFocus - 1 + items.length) % items.length;
        this.setActiveItem(this.currentFocus);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.currentFocus > -1) {
          this.selectItem(this.currentFocus);
        }
        break;
        
      case 'Escape':
        this.close();
        break;
    }
  }

  setActiveItem(index) {
    const items = this.list.querySelectorAll('li[data-index]');
    items.forEach((item, i) => {
      if (i === index) {
        item.style.background = '#e3f2fd';
        item.classList.add('selected');
      } else {
        item.style.background = 'white';
        item.classList.remove('selected');
      }
    });
    
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  selectItem(index) {
    const items = this.list.querySelectorAll('li[data-index]');
    if (items[index]) {
      const selectedText = items[index].textContent;
      this.input.value = selectedText;
      this.onSelect(selectedText);
      this.close();
    }
  }

  showSuggestions() {
    if (!this.input.value.trim()) {
      this.renderSuggestions(this.dataset.slice(0, this.maxSuggestions));
    } else {
      this.handleInput();
    }
  }

  close() {
    this.list.setAttribute('style', this.list.getAttribute('style').replace('display: block', 'display: none'));
    this.currentFocus = -1;
  }

  updateDataset(newDataset) {
    this.dataset = newDataset || [];
    if (document.activeElement === this.input) {
      this.showSuggestions();
    }
  }
}