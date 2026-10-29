export default function ItemInstructions({value='',onChange,name='this item'}){
 return <div className="item-instructions"><label>Special instructions for {name} (optional)<textarea rows={2} maxLength={300} value={value} onChange={e=>onChange(e.target.value)} placeholder="e.g. extra cheese, less spicy, no onion"/></label><small className="muted">{value.length}/300 · Applies to all units of this item. Requests depend on availability; paid extras are not included in this price.</small></div>;
}
