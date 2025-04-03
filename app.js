document.addEventListener('DOMContentLoaded', () => {
    // Add typing effect
    const h1 = document.querySelector('h1');
    const text = h1.dataset.text;
    let i = 0;
    
    function typeWriter() {
        if (i < text.length) {
            h1.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, 10);
        }
    }
    
    typeWriter();

    const contentGrid = document.getElementById('content-grid');
    contentGrid.innerHTML = '<div class="loading-indicator">Loading...</div>';
    let allContent = [];

    function preloadImage(src) {
        return new Promise((resolve, reject) => {
            if (!src) resolve(null);
            const img = new Image();
            img.onload = () => resolve(src);
            img.onerror = () => reject();
            img.src = src;
        });
    }

    async function loadPost(post) {
        // Preload all images in the post
        const imagePromises = post.content
            .filter(item => item.type === 'image')
            .map(item => preloadImage(item.value));
        
        await Promise.all(imagePromises);
        return createPostElement(post);
    }

    // Load all content from JSON file
    fetch('data/posts.json')
        .then(r => r.json())
        .then(async data => {
            // Sort posts by date
            data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Process all posts with loading indicator
            const loadingPromises = data.posts.map(async post => {
                const element = await loadPost(post);
                return {
                    type: post.type,
                    element: element,
                    date: new Date(post.date),
                    originalData: post
                };
            });

            allContent = await Promise.all(loadingPromises);
            contentGrid.innerHTML = ''; // Clear loading indicator
            filterContent('all');
        })
        .catch(error => {
            contentGrid.innerHTML = '<div class="error">Failed to load content</div>';
            console.error('Loading error:', error);
        });

    const menuItems = document.querySelectorAll('menu li');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            filterContent(item.textContent.toLowerCase());
        });
    });

    function filterContent(category) {
        contentGrid.innerHTML = '';
        const filtered = category === 'all' 
            ? allContent 
            : allContent.filter(item => item.type === category);
        
        filtered.forEach(item => {
            const newElement = item.element.cloneNode(true);
            newElement.addEventListener('click', handlePostClick(item.originalData));
            contentGrid.appendChild(newElement);
        });
    }

    function handlePostClick(post) {
        return () => {
            const overlay = document.createElement('div');
            overlay.className = 'fullscreen-overlay';
            
            marked.setOptions({
                breaks: true,
                gfm: true,
                mangle: false,
                headerIds: false
            });
            
            let contentHTML = post.content.map(item => {
                if (item.type === 'markdown') {
                    const parsed = marked.parse(item.value)
                        .replace(/\n/g, '<br>');
                    return `<div class="markdown-content">${parsed}</div>`;
                }
                return '';
            }).join('');

            const content = `
                <div class="fullscreen-content">
                    <button class="close-button">Close</button>
                    <h2>${post.title}</h2>
                    ${post.date ? `<time>${post.date}</time>` : ''}
                    ${contentHTML}
                </div>
            `;
            
            overlay.innerHTML = content;
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';

            const closeBtn = overlay.querySelector('.close-button');
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                document.body.style.overflow = '';
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    document.body.style.overflow = '';
                }
            });
        };
    }

    function createPostElement(post) {
        const element = document.createElement('article');
        element.className = `post ${post.type}`;
        
        const firstContent = post.content.find(item => 
            item.type === 'markdown' || item.type === 'text'
        );
        
        let previewText = '';
        if (firstContent) {
            if (firstContent.type === 'markdown') {
                // Get first paragraph and preserve some formatting
                const cleanText = firstContent.value
                    .split('\n\n')[0]  // Get first paragraph
                    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
                    .replace(/#{1,6}\s/g, '')  // Remove headers
                    .replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>')  // Bold
                    .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>')  // Italic
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')  // Links
                    .trim();

                previewText = cleanText.length > 150 
                    ? cleanText.slice(0, 150) + '...' 
                    : cleanText;
            } else {
                previewText = firstContent.value;
            }
        }

        let content = `
            <h3>${post.title}</h3>
            ${post.date ? `<time>${post.date}</time>` : ''}
            <div class="preview-text">${previewText}</div>
        `;

        element.innerHTML = content;
        return element;
    }
});
