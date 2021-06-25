const guild_GetStaffBadge = (role, elid) => {
    const el = document.getElementById(elid);
    let b = ``;

    if(parseInt(role) == 3) b = `<span class="badge badge-primary purple">Owner</span>`;
    if(parseInt(role) == 2) b = `<span class="badge badge-primary admin">Admin</span>`;
    if(parseInt(role) == 1) b = `<span class="badge badge-primary mod">Mod</span>`;
    if(elid.toLowerCase() == 'return'){
        return b;
    } else {
        return el.innerHTML = b;
    }
}