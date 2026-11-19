export class MotionFormatError extends Error {
  constructor(path, reason) {
    super("动作数据无效: " + path + ", " + reason);
    this.name = "MotionFormatError";
    this.path = path;
  }
}
export function fail(path, reason) {
  throw new MotionFormatError(path, reason);
}
// 只执行本工程固定格式所用的规则, 不加载外部模式或引用.
export function validateSchema(value, schema, path = "$") {
  const matches = type => {
    if (type === "null") return value === null;
    if (type === "array") return Array.isArray(value);
    if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value)
      && [Object.prototype, null].includes(Object.getPrototypeOf(value));
    if (type === "integer") return Number.isInteger(value);
    return typeof value === type;
  };
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!types.some(matches)) fail(path, "类型不匹配");
  if (Object.hasOwn(schema, "const") && value !== schema.const) fail(path, "固定值不匹配");
  if (schema.enum && !schema.enum.includes(value)) fail(path, "不支持的取值");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(path, "必须是有限数值");
    if (value < schema.minimum || value > schema.maximum) fail(path, "数值超出范围");
  }
  if (typeof value === "string") {
    const length = Array.from(value).length;
    if (length < schema.minLength || length > schema.maxLength) fail(path, "字符串长度不正确");
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail(path, "资源路径不合法");
  }
  if (Array.isArray(value)) {
    if (value.length < schema.minItems || value.length > schema.maxItems) fail(path, "数组长度不正确");
    if (schema.uniqueItems && new Set(value).size !== value.length) fail(path, "存在重复项");
    for (let index = 0; index < value.length; index++) {
      validateSchema(value[index], schema.items, path + "[" + index + "]");
    }
  } else if (value !== null && typeof value === "object") {
    for (const key of schema.required) {
      if (!Object.hasOwn(value, key)) fail(path + "." + key, "缺少必需字段");
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties, key)) fail(path + "." + key, "未知字段");
      validateSchema(value[key], schema.properties[key], path + "." + key);
    }
  }
}
