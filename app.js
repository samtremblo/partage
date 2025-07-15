document.addEventListener('DOMContentLoaded', () => {
    const h1 = document.querySelector('h1');
    const text = h1.dataset.text;
    // Only clear and animate if h1 is not already filled
    if (h1.textContent !== text) {
        h1.textContent = '';
        let i = 0;
        function typeWriter() {
            if (i <= text.length) {
                h1.textContent = text.slice(0, i);
                i++;
                setTimeout(typeWriter, 10);
            }
        }
        typeWriter();
    }

    const contentGrid = document.getElementById('content-grid');
    contentGrid.innerHTML = '<div class="loading-indicator">Loading...</div>';

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
        // Preload all images in the post if content exists
        if (post.content && Array.isArray(post.content)) {
            const imagePromises = post.content
                .filter(item => item.type === 'image')
                .map(item => preloadImage(item.value));
            
            await Promise.all(imagePromises);
        }
        return createPostElement(post);
    }

    // Utility to get query params
    function getQueryParams() {
        const params = {};
        window.location.search.replace(/^\?/, '').split('&').forEach(pair => {
            if (!pair) return;
            const [key, value] = pair.split('=');
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        });
        return params;
    }

    // Utility to extract path from query string for GitHub Pages SPA fallback
    function getPathFromQuery() {
        // e.g. ?/projects/coeur-de-loups or ?projects/coeur-de-loups
        const query = window.location.search.replace(/^\?/, '');
        // Remove leading slash if present
        const clean = query.startsWith('/') ? query.slice(1) : query;
        if (clean && clean.includes('/')) {
            return clean.split('?')[0].split('/');
        }
        return null;
    }

    // Utility to get path info
    function getPathInfo() {
        // Remove leading/trailing slashes and split
        const parts = window.location.pathname.replace(/^\/|\/$/g, '').split('/');
        return parts;
    }

    // Load all content from JSON file
    fetch('data/posts.json')
        .then(r => r.json())
        .then(async data => {
            // Sort posts by date
            data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));

            allContent = await Promise.all(data.posts.map(async post => {
                const element = await loadPost(post);
                return {
                    type: post.type,
                    category: post.category || null,
                    slug: post.slug || null,
                    element: element,
                    date: new Date(post.date),
                    originalData: post
                };
            }));
            contentGrid.innerHTML = '';

            const types = getUniqueTypes(data.posts);
            renderTypeMenu(types);

            // Path-based routing (normal)
            const pathParts = getPathInfo();
            // SPA fallback: check if query string contains a path (for GitHub Pages)
            const spaQueryParts = getPathFromQuery();

            if (spaQueryParts && spaQueryParts.length >= 2) {
                // e.g. ?projects/coeur-de-loups or ?/projects/coeur-de-loups
                const [type, slug] = spaQueryParts.slice(-2);
                const postObj = allContent.find(item => item.type === type && item.slug === slug);
                if (postObj) {
                    handlePostClick(postObj.originalData)();
                    filterContent(type);
                } else {
                    filterContent('projects');
                }
            } else if (pathParts.length === 2) {
                // /type/slug
                const [type, slug] = pathParts;
                const postObj = allContent.find(item => item.type === type && item.slug === slug);
                if (postObj) {
                    handlePostClick(postObj.originalData)();
                    filterContent(type);
                } else {
                    filterContent(type);
                }
            } else if (pathParts.length === 1 && pathParts[0]) {
                // /type
                filterContent(pathParts[0]);
            } else {
                // fallback to query params or default
                const params = getQueryParams();
                if (params.slug) {
                    const postObj = allContent.find(item => item.slug === params.slug);
                    if (postObj) {
                        handlePostClick(postObj.originalData)();
                        filterContent('projects');
                    } else {
                        filterContent('projects');
                    }
                } else if (params.category) {
                    filterByCategory(params.category);
                } else {
                    filterContent('projects'); // Default to projects
                }
            }
        })
        .catch(error => {
            contentGrid.innerHTML = '<div class="error">Failed to load content</div>';
            console.error('Loading error:', error);
        });

    function getUniqueTypes(posts) {
        return Array.from(new Set(posts.map(post => post.type).filter(Boolean)));
    }

    function renderTypeMenu(types) {
        const menu = document.getElementById('type-menu');
        menu.innerHTML = '';
        // "all" option
        const allLi = document.createElement('li');
        allLi.textContent = 'all';
        allLi.classList.add('active');
        allLi.onclick = () => filterContent('all');
        menu.appendChild(allLi);

        types.forEach(type => {
            const li = document.createElement('li');
            li.textContent = type;
            li.onclick = () => filterContent(type);
            menu.appendChild(li);
        });
    }

    function filterContent(category) {
        const menuItems = document.querySelectorAll('#type-menu li');
        menuItems.forEach(i => i.classList.remove('active'));
        menuItems.forEach(i => {
            if (i.textContent === category) i.classList.add('active');
            if (category === 'all' && i.textContent === 'all') i.classList.add('active');
        });

        contentGrid.innerHTML = '';
        const filtered = category === 'all'
            ? allContent
            : allContent.filter(item => item.type === category);

        filtered.forEach(item => {
            const newElement = item.element.cloneNode(true);
            newElement.addEventListener('click', handlePostClick(item.originalData));
            // Update preview text for language
            updatePreviewText(newElement, item.originalData);
            contentGrid.appendChild(newElement);
        });
    }

    function updatePreviewText(element, post) {
        // Only for posts with multilingual content
        if (post.content && typeof post.content === 'object' && post.content.french && post.content.english) {
            const firstContent = post.content[currentLang];
            if (firstContent) {
                const previewDiv = element.querySelector('.preview-text');
                if (previewDiv) {
                    // Get first paragraph and preserve some formatting
                    const cleanText = firstContent
                        .split('\n\n')[0]
                        .replace(/!\[.*?\]\(.*?\)/g, '')
                        .replace(/#{1,6}\s/g, '')
                        .replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>')
                        .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>')
                        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
                        .trim();
                    previewDiv.innerHTML = cleanText.length > 150 ? cleanText.slice(0, 150) + '...' : cleanText;
                }
            }
        }
    }

    let currentLang = 'french';

    // Language toggle logic
    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.addEventListener('click', (e) => {
            if (e.target.classList.contains('lang-btn')) {
                document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                currentLang = e.target.getAttribute('data-lang');
                // Re-render posts in the selected language
                // Try to keep the current filter
                const activeMenu = document.querySelector('#type-menu li.active');
                filterContent(activeMenu ? activeMenu.textContent : 'projects');
            }
        });
    }

    function filterByCategory(category) {
        const filtered = allContent.filter(item => item.category === category);
        contentGrid.innerHTML = '';
        filtered.forEach(item => {
            const newElement = item.element.cloneNode(true);
            newElement.addEventListener('click', handlePostClick(item.originalData));
            contentGrid.appendChild(newElement);
        });
        // Optionally update menu active state if you have categories in menu
    }

    function handlePostClick(post) {
        return () => {
            // Save current URL for restoration
            const prevUrl = window.location.pathname + window.location.search;

            // Update browser bar to /type/slug if possible
            if (post.type && post.slug) {
                const newPath = `/partage/${post.type}/${post.slug}`;
                window.history.pushState({ type: post.type, slug: post.slug }, '', newPath);
            }

            const isEncrypted = post.encrypted && post.value;
            
            if (isEncrypted) {
                const password = prompt('This content is encrypted. Please enter the password:');
                if (!password) return;
                
                // Try to decrypt the content
                try {
                    const decryptedData = CryptoJS.AES.decrypt(post.value, password).toString(CryptoJS.enc.Utf8);
                    const decryptedPost = JSON.parse(decryptedData);
                    // Validate decrypted post structure
                    if (!decryptedPost || !Array.isArray(decryptedPost.content)) {
                        throw new Error('Invalid post structure');
                    }
                    post = decryptedPost;
                } catch (e) {
                    alert('Incorrect password or corrupted data');
                    return;
                }
            }

            const overlay = document.createElement('div');
            overlay.className = 'fullscreen-overlay';
            
            marked.setOptions({
                breaks: true,
                gfm: true,
                mangle: false,
                headerIds: false
            });
            
            let contentHTML = '';
            if (post.content && typeof post.content === 'object' && post.content.french && post.content.english) {
                const value = post.content[currentLang];
                contentHTML = `<div class="markdown-content">${marked.parse(value).replace(/\n/g, '<br>')}</div>`;
            } else if (post.content && Array.isArray(post.content)) {
                contentHTML = post.content.map(item => {
                    if (item.type === 'markdown') {
                        const parsed = marked.parse(item.value)
                            .replace(/\n/g, '<br>');
                        return `<div class="markdown-content">${parsed}</div>`;
                    }
                    return '';
                }).join('');
            }

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
                window.history.replaceState({}, '', prevUrl); // Restore previous URL
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    document.body.style.overflow = '';
                    window.history.replaceState({}, '', prevUrl); // Restore previous URL
                }
            });
        };
    }

    function createPostElement(post) {
        const element = document.createElement('article');
        element.className = `post ${post.type}`;
        
        // Check if the post itself is encrypted
        const isEncrypted = post.encrypted && post.value;
        let content;

        if (isEncrypted) {
            content = `
                <h3>[Encrypted Post]</h3>
                    <p class="encrypted-value" style="word-break: break-all;">${post.value}</p>
                    <button class="decrypt-btn">Decrypt</button>
                </div>
            `;
            element.innerHTML = content;

            // Add decrypt button handler
            const decryptBtn = element.querySelector('.decrypt-btn');
            decryptBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent post click event
                const password = prompt('Enter decryption password:');
                if (password) {
                    try {
                        const decryptedData = CryptoJS.AES.decrypt(post.value, password).toString(CryptoJS.enc.Utf8);
                        const decryptedPost = JSON.parse(decryptedData);
                        // Update the post content with decrypted data
                        element.innerHTML = createPostContent(decryptedPost);
                        // Update the original data for the click handler
                        post = decryptedPost;
                    } catch (err) {
                        alert('Invalid password or corrupted data');
                    }
                }
            });
            return element;
        }

        element.innerHTML = createPostContent(post);
        return element;
    }

    function createPostContent(post) {
        // Multilingual support
        let previewText = '';
        if (post.content && typeof post.content === 'object' && post.content.french && post.content.english) {
            const value = post.content[currentLang];
            if (value) {
                const cleanText = value
                    .split('\n\n')[0]
                    .replace(/!\[.*?\]\(.*?\)/g, '')
                    .replace(/#{1,6}\s/g, '')
                    .replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>')
                    .replace(/(\*|_)(.*?)\1/g, '<em>$2</em>')
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
                    .trim();
                previewText = cleanText.length > 150 ? cleanText.slice(0, 150) + '...' : cleanText;
            }
        } else if (post.content && Array.isArray(post.content)) {
            const firstContent = post.content.find(item =>
                item.type === 'markdown' || item.type === 'text'
            );
            if (firstContent) {
                previewText = firstContent.value;
            }
        }

        return `
            <h3>${post.title}</h3>
            ${post.date ? `<time>${post.date}</time>` : ''}
            <div class="preview-text">${previewText}</div>
        `;
    }
});
