import pako from 'pako';

export enum TagTypes{ end, byte, short, int, long, float, double, byteArray, string, list, compound, intArray, longArray };
type Pair<Tag, Type> = {type: Tag, value: Type};
type List<Tag extends TagTypes> = Tag extends TagTypes ? { listType: Tag, list: TagTypeTypes[Tag]['value'][] } : never;
export type TagTypeTypes = {
  [TagTypes.end]: Pair<TagTypes.end, 0>;
  [TagTypes.byte]: Pair<TagTypes.byte, number>;
  [TagTypes.short]: Pair<TagTypes.short, number>;
  [TagTypes.int]: Pair<TagTypes.int, number>;
  [TagTypes.long]: Pair<TagTypes.long, bigint>;
  [TagTypes.float]: Pair<TagTypes.float, number>;
  [TagTypes.double]: Pair<TagTypes.double, number>;
  [TagTypes.byteArray]: Pair<TagTypes.byteArray, number[]>;
  [TagTypes.string]: Pair<TagTypes.string, string>;
  [TagTypes.list]: Pair<TagTypes.list, List<TagTypes>>;
  [TagTypes.compound]: Pair<TagTypes.compound, {[key in string]?: TagTypeTypes[TagTypes]}>;
  [TagTypes.intArray]: Pair<TagTypes.intArray, number[]>;
  [TagTypes.longArray]: Pair<TagTypes.longArray, bigint[]>;
}

export default class NBTController{
  tag: TagTypeTypes[TagTypes.compound];
  compressed: boolean;
  constructor(public name: string, data: Uint8Array){
    this.compressed = data[0] === 0x1f && data[1] === 0x8b;
    if(this.compressed) data = pako.inflate(data);
    this.tag = decodeNBT(data);
    const encoded = encodeNBT(this.tag, this.compressed);
    const redecoded = decodeNBT(encoded);
    console.log(this.tag, redecoded);
  }
}

const encodeNBT = (nbt: TagTypeTypes[TagTypes.compound], compress: boolean) => {
  let data = new DataView(new ArrayBuffer(256));
  let offset = 0;
  const accommodate = (size: number) => {
    const reqLen = offset + size;
    if(data.byteLength < reqLen) {
      const newLen = 2 ** Math.ceil(Math.log2(reqLen));
      const newArr = new Uint8Array(new ArrayBuffer(newLen));
      newArr.set(new Uint8Array(data.buffer));
      if(offset > data.byteLength) {
        console.log('how is this even possible??');
        newArr.fill(0,data.byteLength,offset);
      }
      data = new DataView(newArr.buffer);
    }
    return () => offset += size;
  }
  (function helper(tag: TagTypeTypes[TagTypes]){
    switch(tag.type){
      case TagTypes.end: {
        const shift = accommodate(1);
        data.setInt8(offset, TagTypes.end);
        shift();
        return;
      }
      case TagTypes.byte: {
        const shift = accommodate(1);
        data.setInt8(offset, tag.value);
        shift();
        return;
      }
      case TagTypes.short: {
        const shift = accommodate(2);
        data.setInt16(offset, tag.value);
        shift();
        return;
      }
      case TagTypes.int: {
        const shift = accommodate(4);
        data.setInt32(offset, tag.value);
        shift();
        return;
      }
      case TagTypes.long: {
        const shift = accommodate(8);
        data.setBigInt64(offset, tag.value);
        shift();
        return;
      }
      case TagTypes.float: {
        const shift = accommodate(4);
        data.setFloat32(offset, tag.value);
        shift();
        return;
      }
      case TagTypes.double: {
        const shift = accommodate(4);
        data.setFloat64(offset, tag.value);
        shift();
        return;
      }
      case TagTypes.byteArray: {
        helper({type:TagTypes.int,value:tag.value.length})
        const shift = accommodate(tag.value.length);
        tag.value.forEach((b,i)=>data.setInt8(offset+i,b));
        shift();
        return;
      }
      case TagTypes.string: {
        helper({type:TagTypes.short,value:tag.value.length})
        const shift = accommodate(tag.value.length);
        Buffer.from(tag.value).forEach((b,i)=>data.setInt8(offset+i,b));
        shift();
        return;
      }
      case TagTypes.list: {
        helper({type:TagTypes.byte,value:tag.value.listType});
        helper({type:TagTypes.int,value:tag.value.list.length});
        tag.value.list.forEach((entry: TagTypeTypes[TagTypes]['value'])=>helper({type:tag.value.listType,value:entry} as TagTypeTypes[TagTypes]));
        return;
      }
      case TagTypes.compound: {
        const pairs = Object.entries(tag.value);
        pairs.forEach(([key, value]) => {
          if(value === undefined) return;
          helper({type:TagTypes.byte,value:value.type});
          helper({type:TagTypes.string,value:key});
          helper(value);
        });
        helper({type:TagTypes.end,value:0});
        return;
      }
      case TagTypes.intArray: {
        helper({type:TagTypes.int,value:tag.value.length*4})
        const shift = accommodate(tag.value.length*4);
        tag.value.forEach((b,i)=>data.setInt32(offset+i*4,b));
        shift();
        return;
      }
      case TagTypes.longArray: {
        helper({type:TagTypes.int,value:tag.value.length*8})
        const shift = accommodate(tag.value.length*8);
        tag.value.forEach((b,i)=>data.setBigInt64(offset+i*8,b));
        shift();
        return;
      }
    }
  })(nbt);
  return new Uint8Array(data.buffer.slice(0,offset-1));
}

const decodeNBT = (raw: Uint8Array) => {
  const data = new DataView(raw.buffer);
  let offset = 0;
  const methods = {
    [TagTypes.end](){ return { value: 0, type: TagTypes.end } as TagTypeTypes[TagTypes.end]; },
    [TagTypes.byte](){
      const value = data.getInt8(offset);
      offset +=1 ;
      return { value, type: TagTypes.byte } as TagTypeTypes[TagTypes.byte];
    },
    [TagTypes.short](){
      const value = data.getInt16(offset);
      offset += 2;
      return { value, type: TagTypes.short } as TagTypeTypes[TagTypes.short];
    },
    [TagTypes.int]() {
      const value = data.getInt32(offset);
      offset += 4;
      return { value, type: TagTypes.int } as TagTypeTypes[TagTypes.int];
    },
    [TagTypes.long](){
      const value = data.getBigInt64(offset);
      offset += 4;
      return { value, type: TagTypes.long } as TagTypeTypes[TagTypes.long];
    },
    [TagTypes.float](){
      const value = data.getFloat32(offset);
      offset += 4;
      return { value, type: TagTypes.float } as TagTypeTypes[TagTypes.float];
    },
    [TagTypes.double](){
      const value = data.getFloat64(offset);
      offset += 8;
      return { value, type: TagTypes.double } as TagTypeTypes[TagTypes.double];
    },
    [TagTypes.byteArray](){
      const len = this[TagTypes.int]().value;
      const value: number[] = [];
      for(let i = 0; i < len; i++) value.push(this[TagTypes.byte]().value);
      return { value, type: TagTypes.byteArray } as TagTypeTypes[TagTypes.byteArray];
    },
    [TagTypes.string](){
      const len = this[TagTypes.short]().value;
      const slice = data.buffer.slice(offset, offset + len);
      offset += len;
      return { value: (new TextDecoder('utf-8')).decode(slice), type: TagTypes.string } as TagTypeTypes[TagTypes.string];
    },
    [TagTypes.list](){
      const type: TagTypes = this[TagTypes.byte]().value;
      const len = this[TagTypes.int]().value;
      const list: TagTypeTypes[TagTypes]['value'][] = [];
      for(let i = 0; i < len; i++) list.push(this[type]().value); 
      return { value: { listType: type, list }, type: TagTypes.list } as TagTypeTypes[TagTypes.list];
    },
    [TagTypes.compound](){
      const tag: {[key: string]: TagTypeTypes[TagTypes]} = {};
      while(true){
        const type: TagTypes = this[TagTypes.byte]().value;
        if(type === TagTypes.end) break;
        tag[this[TagTypes.string]().value] = this[type]();
      }
      return { value: tag, type: TagTypes.compound } as TagTypeTypes[TagTypes.compound];
    },
    [TagTypes.intArray](){
      const len = this[TagTypes.int]().value;
      const value: number[] = [];
      for(let i = 0; i < len; i++) value.push(this[TagTypes.int]().value);
      return { value, type: TagTypes.intArray } as TagTypeTypes[TagTypes.intArray];
    },
    [TagTypes.longArray](){
      const len = this[TagTypes.int]().value;
      const value: bigint[] = [];
      for(let i = 0; i < len; i++) value.push(this[TagTypes.long]().value);
      return { value, type: TagTypes.longArray } as TagTypeTypes[TagTypes.longArray];
    },
  }
  const compoundTag = methods[TagTypes.byte]();
  if(compoundTag.value !== TagTypes.compound) throw new Error('Root Tag should be compound');
  return {
    type: TagTypes.compound as const,
    value: {
      [methods[TagTypes.string]().value]: methods[TagTypes.compound](),
    },
  }
}
