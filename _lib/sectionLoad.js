// default config
const CONFIG = {
    API_BASE_URL: 'http://127.0.0.1:8000/api',
    MATH_DELIMITERS: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true }
    ]
};

const sectionText = document.querySelector('#content #section-text');

function getBlogContent(apiPath) {
    sectionText.innerHTML = '<p>正在请求数据，请稍候...</p>';
    const fullUrl = CONFIG.API_BASE_URL + apiPath;

    fetch(fullUrl)
        .then(response => response.json())
        .then(data => { 
            const mathBlocks = [];
            let dataWithoutMath = data.data;

            dataWithoutMath = dataWithoutMath.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
                mathBlocks.push(match); // 将行间公式加入 mathBlocks
                return `@@MATH-${mathBlocks.length - 1}@@`; // 占位符标记·行间公式
            });
            dataWithoutMath = dataWithoutMath.replace(/\$([^\$\n]+?)\$/g, (match) => {
                mathBlocks.push(match); // 将行内公式加入 mathBlocks
                return `@@MATH-${mathBlocks.length - 1}@@`; // 占位符标记·行内公式
            });

            let html = marked.parse(dataWithoutMath);

            mathBlocks.forEach((math, index) => {
                // 将列表中的公式替换回 HTML 中
                html = html.replace(`@@MATH-${index}@@`, () => math); // 对于指定索引的公式，直接返回存储的公式
            });

            sectionText.innerHTML = html; 
            renderMathInElement(sectionText, {
                delimiters: CONFIG.MATH_DELIMITERS
            });
        })
        .catch(error => {
            console.error('请求失败:', error);
            sectionText.innerText = '请求失败: ' + error.message;
        });
}

function getNormalContent(apiPath) {
    sectionText.innerHTML = '<p>正在请求数据，请稍候...</p>';
    const fullUrl = CONFIG.API_BASE_URL + apiPath;

    fetch(fullUrl)
        .then(response => response.text())
        .then(data => { 
            let html = marked.parse(data);
            sectionText.innerHTML = html; 
        })
        .catch(error => {
            console.error('请求失败:', error);
            sectionText.innerText = '请求失败: ' + error.message;
        });
}


const navLinks = document.querySelectorAll('#header nav a');

navLinks.forEach(link => {
    link.addEventListener('click', event => {
        // 获取用户点击的链接原本要去哪里 (比如 "/blogs", "/tags")
        const targetPath = link.getAttribute('href');

        // 如果是有效路径（比如以 "/" 开头）
        if (targetPath && targetPath.startsWith('/')) {
            event.preventDefault(); // 阻止跳转
            // getBlogContent(targetPath); // 召唤通用函数去干活！
            getNormalContent(targetPath); // 召唤通用函数去干活！
        }
    });
});