import test from 'node:test';import assert from 'node:assert/strict';import {validateDependencies} from './task-dependencies.mjs';
test('rejects unknown, self, transitive cycles, and child depending on parent completion',()=>{
 const a={id:'a',dependsOn:[]},b={id:'b',dependsOn:['a']},c={id:'c',dependsOn:['b']};
 assert.throws(()=>validateDependencies([a,b],{...a,dependsOn:['a']}));assert.throws(()=>validateDependencies([a,b],{...a,dependsOn:['not-owned']}));assert.throws(()=>validateDependencies([a,b,c],{...a,dependsOn:['c']}));assert.throws(()=>validateDependencies([a,b],{...b,parentId:'a',dependsOn:['a']}));assert.doesNotThrow(()=>validateDependencies([a,b,c],{...a,dependsOn:[]}));
});
