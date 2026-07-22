analyticsBuckets=function(data,days){
  const parsed=(Array.isArray(data)?data:[]).map(batch=>{
    const date=new Date(batch?.timestamp);
    return Number.isNaN(date.getTime())?null:{date,value:Array.isArray(batch?.labels)?batch.labels.length:0};
  }).filter(Boolean);
  const today=new Date();today.setHours(0,0,0,0);
  if(days===0){
    if(!parsed.length)return[];
    const earliest=new Date(Math.min(...parsed.map(item=>item.date.getTime())));
    const start=new Date(earliest.getFullYear(),earliest.getMonth(),1);
    const end=new Date(today.getFullYear(),today.getMonth()+1,1);
    const monthCount=(end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth();
    if(monthCount<=24){
      const values=new Array(monthCount).fill(0);
      parsed.forEach(item=>{
        const index=(item.date.getFullYear()-start.getFullYear())*12+item.date.getMonth()-start.getMonth();
        if(index>=0&&index<values.length)values[index]+=item.value;
      });
      return values.map((value,index)=>{
        const from=new Date(start.getFullYear(),start.getMonth()+index,1);
        return{label:from.toLocaleDateString('en-GB',monthCount>12?{month:'short',year:'2-digit'}:{month:'short'}),value};
      });
    }
    const firstYear=start.getFullYear(),yearCount=today.getFullYear()-firstYear+1,values=new Array(yearCount).fill(0);
    parsed.forEach(item=>{const index=item.date.getFullYear()-firstYear;if(index>=0&&index<values.length)values[index]+=item.value});
    return values.map((value,index)=>({label:String(firstYear+index),value}));
  }

  const groups=days===30?30:7,start=new Date(today);
  start.setDate(start.getDate()-(groups-1));
  const values=new Array(groups).fill(0);
  const dayNumber=date=>Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
  const startDay=dayNumber(start);
  parsed.forEach(item=>{
    const delta=dayNumber(item.date)-startDay;
    const index=delta;
    if(index>=0&&index<values.length)values[index]+=item.value;
  });
  return values.map((value,index)=>{
    const from=new Date(start);from.setDate(from.getDate()+index);
    return{label:days===30?from.toLocaleDateString('en-GB',{day:'numeric',month:'short'}):from.toLocaleDateString('en-GB',{weekday:'short'}),value};
  });
};
