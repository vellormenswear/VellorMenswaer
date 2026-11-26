export const DEPARTMENTS=Object.freeze(['masculino','feminino']);
export const validDepartment=value=>DEPARTMENTS.includes(value);
export function catalogDepartment(value){if(value===null||value===''||value==='todos')return null;if(!validDepartment(value))throw Error('Departamento inválido.');return value;}
