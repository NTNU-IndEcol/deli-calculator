// frontend/static/js/ui/autocomplete.js

export class AutocompleteHandler {
  /**
   * @param {Object} config - Configuration object
   * @param {string} config.input - CSS selector for input element
   * @param {Array} config.dataset - Array of suggestions
   * @param {Function} config.onSelect - Selection callback
   * @param {number} config.maxSuggestions - Maximum number of suggestions to show
   */
  constructor({ input, dataset, onSelect, maxSuggestions = 10 }) {
    this.input = document.querySelector(input);
    this.dataset = dataset;
    this.onSelect = onSelect;
    this.maxSuggestions = maxSuggestions;
    this.currentFocus = -1;
    this.input.autocompleteInstance = this;
    
    if (!this.input) {
      throw new Error(`Input element not found: ${input}`);
    }

    this.createListElement();
    this.setupEventListeners();
  }

  createListElement() {
    this.list = document.createElement('ul');
    this.list.className = 'autocomplete-list';
    Object.assign(this.list.style, {
      position: 'absolute',
      zIndex: '1000',
      backgroundColor: '#fff',
      border: '1px solid #ddd',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      maxHeight: '200px',
      overflowY: 'auto'
    });
    
    this.input.parentNode.appendChild(this.list);
    this.positionList();
  }

  positionList() {
    const rect = this.input.getBoundingClientRect();
    this.list.style.left = `${rect.left}px`;
    this.list.style.top = `${rect.bottom + window.scrollY}px`;
    this.list.style.width = `${rect.width}px`;
  }

  setupEventListeners() {
    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.input.addEventListener('focus', () => this.showSuggestions());
    
    window.addEventListener('resize', () => this.positionList());
    document.addEventListener('click', (e) => this.handleOutsideClick(e));
  }

  static injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .autocomplete-list {
        position: absolute;
        z-index: 1000;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        max-height: 200px;
        overflow-y: auto;
        margin: 0;
        padding: 0;
        list-style: none;
      }
  
      .autocomplete-list li {
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.2s;
      }
  
      .autocomplete-list li.selected {
        background-color: #f0f8ff;
        font-weight: 500;
      }
  
      .autocomplete-list li:hover {
        background-color: #f5f5f5;
      }
    `;
    document.head.appendChild(style);
  }

  handleInput() {
    const value = this.input.value.toLowerCase();
    const filtered = this.dataset.filter(item => 
      item.toLowerCase().includes(value)
    ).slice(0, this.maxSuggestions);
    
    this.renderSuggestions(filtered);
  }

  renderSuggestions(items) {
    this.list.innerHTML = items.map((item, index) => `
      <li class="${index === this.currentFocus ? 'selected' : ''}" 
          data-index="${index}"
          role="option"
          aria-selected="${index === this.currentFocus}">
        ${item}
      </li>
    `).join('');

    this.list.querySelectorAll('li').forEach((li, index) => {
      li.addEventListener('click', () => this.selectItem(index));
      li.addEventListener('mouseover', () => this.setActiveItem(index));
    });

    this.list.style.display = items.length ? 'block' : 'none';
    this.currentFocus = -1;
  }

  // Add to handleKeyDown() method
  handleKeyDown(e) {
    const items = this.list.querySelectorAll('li');
    if (!items.length) return;

    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.currentFocus = (this.currentFocus + 1) % items.length;
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.currentFocus = (this.currentFocus - 1 + items.length) % items.length;
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
        
      case 'Tab':
        if (this.currentFocus > -1) {
          this.selectItem(this.currentFocus);
        }
        this.close();
        break;
        
        
      default:
        return;
    }
    
    this.setActiveItem(this.currentFocus);
  }

  setActiveItem(index) {
    const items = this.list.querySelectorAll('li');
    items.forEach(item => {
      item.classList.remove('selected');
      item.setAttribute('aria-selected', 'false');
    });
    
    if (index > -1 && items[index]) {
      items[index].classList.add('selected');
      items[index].setAttribute('aria-selected', 'true');
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  selectItem(index) {
    const items = this.list.querySelectorAll('li');
    if (items[index]) {
      this.input.value = items[index].textContent;
      this.onSelect(items[index].textContent);
      this.close();
    }
  }

  showSuggestions() {
    if (!this.input.value.trim()) {
      this.renderSuggestions(this.dataset.slice(0, this.maxSuggestions));
    }
    this.positionList();
  }

  handleOutsideClick(e) {
    if (!this.input.contains(e.target)) {
      this.close();
    }
  }

  close() {
    this.list.style.display = 'none';
    this.currentFocus = -1;
  }

  updateDataset(newDataset) {
    this.dataset = newDataset;
    if (document.activeElement === this.input) {
      this.showSuggestions();
    }
  }
}


// Style injection at end
AutocompleteHandler.injectStyles(); 