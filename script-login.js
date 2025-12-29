// 防止页面缩放
window.addEventListener("wheel", (e)=> {
    const isPinching = e.ctrlKey
    if(isPinching) e.preventDefault()
}, { passive: false })

// 页面加载完成后的初始化
window.addEventListener('load', function() {
    console.log('Login page fully loaded');
});