(()=>{
  let repaired=false;

  if(!Array.isArray(users)){
    users=[{name:'Rayhan Ardhana',nickname:'Rayhan'}];
    save('ksb-users',users);
    repaired=true;
  }else{
    const normalizedUsers=users
      .filter(user=>user&&clean(user.name))
      .map(user=>({name:clean(user.name),nickname:clean(user.nickname)||clean(user.name).split(/\s+/)[0]}));
    if(!normalizedUsers.length)normalizedUsers.push({name:'Rayhan Ardhana',nickname:'Rayhan'});
    if(JSON.stringify(normalizedUsers)!==JSON.stringify(users)){
      users=normalizedUsers;
      save('ksb-users',users);
      repaired=true;
    }
  }

  if(!LAYOUTS[layout]){
    layout='3x2';
    try{localStorage.setItem('ksb-layout',layout)}catch{}
    repaired=true;
  }

  if(!companyPrefixes||typeof companyPrefixes!=='object'||Array.isArray(companyPrefixes)){
    companyPrefixes={};
    save(COMPANY_PREFIX_KEY,companyPrefixes);
    repaired=true;
  }

  if(!Array.isArray(labels)){
    labels=[];
    save('ksb-labels',labels);
    repaired=true;
  }

  if(!Array.isArray(history)){
    history=[];
    save('ksb-history',history);
    repaired=true;
  }

  if(repaired)console.info('LabelPrint repaired invalid local state.');
})();