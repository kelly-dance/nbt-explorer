import React, { useState } from 'react';
import NBTController from './NBTController';

const InitializeNBT = (f: File): Promise<NBTController | undefined> => {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      if(!e.target?.result || typeof e.target?.result !== 'object') throw new Error(`Error getting binary data for ${f.name}`);
      let data = new Uint8Array(e.target.result);
      resolve(new NBTController(f.name, data));
    }
    reader.readAsArrayBuffer(f);
  });
}

type DisplayData = 
  {type: 'nbt', nbt: NBTController} |
  {type: 'error', error: string} |
  {type: 'waiting'}

function App() {
  const [data, setData] = useState<DisplayData>({type:'waiting'});
  const uploadHandler = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if(!e.target.files) return;
    try{
      const nbt = await InitializeNBT(e.target.files[0]);
      console.log(nbt);
      if(nbt) setData({type:'nbt',nbt});
      else setData({type:'waiting'});
    }catch(e){
      setData({type:'error', error:String(e)})
    }
  }
  return (
    <div>
      <input type="file" onChange={uploadHandler}/>
      {data.type==='nbt'?(
        <div>
          {data.nbt.name}
        </div>
      ):data.type==='error'?(
        <div>
          {data.error}
        </div>
      ):''}
    </div>
  );
}

export default App;
