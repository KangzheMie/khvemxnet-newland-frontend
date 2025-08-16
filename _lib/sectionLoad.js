// 📋 配置中心
const CONFIG = {
    API_BASE_URL: 'http://127.0.0.1:8000/api',
    PAGE_SIZE: 20,
    CACHE_TTL: 5 * 60 * 1000, // 5分钟缓存
    MATH_DELIMITERS: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true }
    ]
};

// 🌐 API服务类
class APIService {
    constructor(baseURL = CONFIG.API_BASE_URL) {
        this.baseURL = baseURL;
    }

    // 🔗 构建完整API URL
    buildURL(endpoint, params = {}) {
        const url = new URL(`${this.baseURL}${endpoint}`);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });
        return url.toString();
    }

    // 📡 发送API请求
    async request(endpoint, params = {}) {
        try {
            const url = this.buildURL(endpoint, params);
            console.log('🌐 API请求:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || '请求失败');
            }
            
            return data;
        } catch (error) {
            console.error('❌ API请求失败:', error);
            throw error;
        }
    }

    // 📚 获取分类下的博客列表
    async getCategoryBlogs(categoryName, page = 1, pageSize = CONFIG.PAGE_SIZE) {
        return this.request(`/categories/${encodeURIComponent(categoryName)}/blogs`, {
            page,
            page_size: pageSize
        });
    }

    // 📖 根据ID获取博客详情
    async getBlogById(id) {
        return this.request(`/blogs/${id}`);
    }

    // 📝 根据标题获取博客详情
    async getBlogByTitle(title) {
        return this.request(`/blogs/by-title/${encodeURIComponent(title)}`);
    }

    // 🏠 获取博客列表（主页）
    async getBlogs(page = 1, pageSize = CONFIG.PAGE_SIZE, filters = {}) {
        return this.request('/blogs', {
            page,
            page_size: pageSize,
            ...filters
        });
    }
}

// 🎨 内容渲染器
class ContentRenderer {
    constructor(contentLoader = null) {
        this.contentLoader = contentLoader;
        this.setupMarkdownRenderer();
    }

    // ⚙️ 设置Markdown渲染器
    setupMarkdownRenderer() {
        const renderer = {
            em({ tokens }) {
                const text = this.parser.parseInline(tokens);
                return `_${text}_`;
            }
        };
        marked.use({ renderer });
    }

    // 📋 渲染文章列表
    renderArticleList(blogs, title = '文章列表') {
        if (!blogs || blogs.length === 0) {
            document.getElementById('section-text').innerHTML = `
                <div class="no-content">
                    <h2>${title}</h2>
                    <p>暂无文章</p>
                </div>
            `;
            return;
        }

        const listItems = blogs.map(blog => {
            const date = new Date(blog.created_at || blog.date).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\//g, '-');
            
            return `
                <li>
                    <a href="#" data-blog-id="${blog.id}" data-blog-title="${blog.title}">
                        <span class="article-date">${date}</span>
                        <span class="article-title">${blog.title}</span>
                    </a>
                </li>
            `;
        }).join('');

        document.getElementById('section-text').innerHTML = `
            <div class="article-list-container">
                <h2>${title}</h2>
                <ul class="article-list">
                    ${listItems}
                </ul>
            </div>
        `;

        // 添加点击事件监听
        this.attachArticleListeners();
    }

    // 🎯 渲染Markdown内容
    renderContent(markdownString) {
        try {
            const html = marked.parse(markdownString || '');
            document.getElementById('section-text').innerHTML = html;
            
            // 异步渲染数学公式和代码高亮
            requestAnimationFrame(() => {
                this.renderMath();
                this.highlightCode();
            });
        } catch (error) {
            console.error('Markdown渲染失败:', error);
            document.getElementById('section-text').innerHTML = `
                <p class="error">内容渲染失败</p>
                <details>
                    <summary>查看原始内容</summary>
                    <pre>${markdownString}</pre>
                </details>
            `;
        }
    }

    // 🔗 添加文章列表点击事件
    attachArticleListeners() {
        const articleLinks = document.querySelectorAll('.article-list a');
        articleLinks.forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const blogId = e.currentTarget.dataset.blogId;
                const blogTitle = e.currentTarget.dataset.blogTitle;
                
                if (this.contentLoader) {
                    await this.contentLoader.loadBlogContent(blogId, blogTitle);
                } else if (window.ContentLoader && window.ContentLoader.app) {
                    await window.ContentLoader.app.loadBlogContent(blogId, blogTitle);
                }
            });
        });
    }

    // 🧮 渲染数学公式
    renderMath() {
        if (typeof renderMathInElement !== 'undefined') {
            renderMathInElement(document.getElementById('section-text'), {
                delimiters: CONFIG.MATH_DELIMITERS
            });
        }
    }

    // 🎨 代码高亮
    highlightCode() {
        if (typeof hljs !== 'undefined') {
            hljs.highlightAll();
        }
    }
}

// 🚀 主应用类
class ContentLoader {
    constructor() {
        this.apiService = new APIService();
        this.renderer = new ContentRenderer(this);
        this.currentPath = window.location.pathname;
        this.init();
    }

    // 🎬 初始化应用
    async init() {
        this.setupRouting();
        await this.handleCurrentRoute();
        console.log('🎉 NewLand 内容加载器已启动！');
    }

    // 🛣️ 设置路由处理
    setupRouting() {
        // 监听浏览器前进后退
        window.addEventListener('popstate', () => {
            this.handleCurrentRoute();
        });

        // 监听导航链接点击
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && this.isInternalLink(link.href)) {
                e.preventDefault();
                this.navigateTo(link.href);
            }
        });
    }

    // 🔍 判断是否为内部链接
    isInternalLink(href) {
        try {
            const url = new URL(href, window.location.origin);
            return url.origin === window.location.origin;
        } catch {
            return false;
        }
    }

    // 🧭 导航到指定路径
    async navigateTo(href) {
        const url = new URL(href, window.location.origin);
        const path = url.pathname;
        
        if (path !== this.currentPath) {
            this.currentPath = path;
            window.history.pushState({}, '', href);
            await this.handleCurrentRoute();
        }
    }

    // 🎯 处理当前路由
    async handleCurrentRoute() {
        const path = this.currentPath;
        console.log('🛣️ 处理路由:', path);

        try {
            if (path === '/' || path === '/index.html' || path === '') {
                await this.loadHomePage();
            } else if (path.startsWith('/category/')) {
                const categoryName = path.split('/category/')[1];
                await this.loadCategoryPage(categoryName);
            } else if (path.startsWith('/blog/')) {
                const blogId = path.split('/blog/')[1];
                await this.loadBlogPage(blogId);
            } else if (path === '/about') {
                await this.loadAboutPage();
            } else {
                this.show404();
            }
        } catch (error) {
            console.error('❌ 路由处理失败:', error);
            this.showError('页面加载失败', error.message);
        }
    }

    // 🏠 加载主页
    async loadHomePage() {
        console.log('📖 加载主页...');
        const response = await this.apiService.getBlogs(1, 20);
        this.renderer.renderArticleList(response.data, '最新文章');
    }

    // 📂 加载分类页面
    async loadCategoryPage(categoryName) {
        console.log('📂 加载分类页面:', categoryName);
        const response = await this.apiService.getCategoryBlogs(categoryName);
        this.renderer.renderArticleList(response.data, `分类: ${categoryName}`);
    }

    // 📖 加载博客页面
    async loadBlogPage(blogId) {
        console.log('📖 加载博客页面:', blogId);
        const response = await this.apiService.getBlogById(blogId);
        this.renderer.renderContent(response.data.content);
    }

    // 📝 加载博客内容（用于文章列表点击）
    async loadBlogContent(blogId, blogTitle) {
        console.log('📝 加载博客内容:', blogId, blogTitle);
        try {
            const response = await this.apiService.getBlogById(blogId);
            this.renderer.renderContent(response.data.content);
            
            // 更新URL但不触发路由处理
            const newUrl = `/blog/${blogId}`;
            if (newUrl !== this.currentPath) {
                this.currentPath = newUrl;
                window.history.pushState({}, blogTitle, newUrl);
            }
        } catch (error) {
            console.error('❌ 加载博客内容失败:', error);
            this.showError('文章加载失败', error.message);
        }
    }

    // ℹ️ 加载关于页面
    async loadAboutPage() {
        console.log('ℹ️ 加载关于页面...');
        // 这里可以加载静态内容或从API获取
        this.renderer.renderContent('# 关于\n\n这里是关于页面的内容。');
    }

    // ❌ 显示404页面
    show404() {
        document.getElementById('section-text').innerHTML = `
            <div class="error-page">
                <h1>404</h1>
                <p>页面未找到</p>
                <a href="/">返回首页</a>
            </div>
        `;
    }

    // ⚠️ 显示错误信息
    showError(title, message) {
        document.getElementById('section-text').innerHTML = `
            <div class="error-page">
                <h2>${title}</h2>
                <p>${message}</p>
                <button onclick="location.reload()">重新加载</button>
            </div>
        `;
    }
}

// 🚀 应用启动
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ContentLoader();
});

// 🌍 全局导出（用于调试）
window.ContentLoader = { app, CONFIG };