const wait = (delay = 0) =>
  new Promise(resolve => setTimeout(resolve, delay));

const hash_app = $("#app");
const hash_ls = $("#loading-screen");

hash_app.css("display","none");
hash_ls.css("display","block");

document.addEventListener('DOMContentLoaded', () =>
  wait(500).then(() => {
    hash_app.css("display","block");
    hash_ls.css("display","none");
}));