// Package.json bilgileri statik olarak tanımla
export const packageJson = {
  name: "@locodex/cli",
  version: "1.0.0",
  description: "LocoDex Terminal CLI - AI Destekli Yazılım Mühendisliği Platformu"
};

export const getVersion = (): string => {
  return packageJson.version;
};

export const getName = (): string => {
  return packageJson.name;
};

export const getDescription = (): string => {
  return packageJson.description;
};

