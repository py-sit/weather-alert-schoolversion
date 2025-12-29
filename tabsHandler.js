// Function to initialize tab functionality
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabTitle = document.getElementById('current-tab-title');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', function() {
        const tabId = this.dataset.tab;
        
        // Remove active class from all tab buttons and hide all tab contents
        tabButtons.forEach(btn => btn.classList.remove('active', 'bg-gray-100'));
        tabContents.forEach(content => content.classList.add('hidden'));
        
        // Add active class to clicked tab button and show corresponding tab content
        this.classList.add('active', 'bg-gray-100');
        document.getElementById(tabId).classList.remove('hidden');
        
        // Update the title in the header
        if (tabTitle) {
          tabTitle.textContent = this.textContent.trim();
        }
      });
    });
  }
  