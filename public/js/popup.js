function _popup(title, text, type){Swal.fire({
    title: title,
    text: text,
    icon: type
})}
const Toast = Swal.mixin({
    toast: true,
    position: 'top-right',
    iconColor: 'white',
    showConfirmButton: false,
    customClass: {
      popup: 'colored-toast'
    },
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer)
      toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
})

const notification = (msg, url) => {
  if(!msg) return console.error("No notification message provided!");
  let urlP1 = ``;
  let urlP2 = ``;
  let eurl = ``;


  const x_url = url ? urlP1 = `<a style="text-decoration:none;color:inherit;" href="${url}">` : ``;
  const z_url = url ? urlP2 = `</a>` : ``;

  var x = document.getElementById("snackbar");
  x.innerHTML = `${x_url}<b style="color:#3fc3ee!important;">Info</b> ${escapeHtml(msg)}${z_url}`;

  x.className = "show";
  setTimeout(function () {
    x.className = x.className.replace("show", "");
    x.innerHTML = ``;
  }, 4000);
}