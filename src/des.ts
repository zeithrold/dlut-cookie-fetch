import {
  EXPAND_PERMUTE_BOX,
  FINAL_PERMUTE_BOX,
  INITIAL_PERMUTE_BOX,
  KEY_GENERATE_OFFSET,
  KEY_SECOND_PERMUTE_BOX,
  P_PERMUTE_BOX,
  S_PERMUTE_BOX,
  S_PERMUTE_BOX_POSITION,
} from './constants'

function encryptString(data: string, keyRing: string[]) {
  const dataByte = stringToByte(data)
  const keyRingByte = keyRing.map(stringToByte)
  const keyByte = keyRingByte.flat()
  let result = ''
  dataByte.forEach((byte) => {
    keyByte.forEach((key) => {
      byte = encrypt(byte, key)
    })
    result += binaryToHexWithGroup(byte)
  })
  return result
}

function binaryToHexWithGroup(data: number[]) {
  if (data.length !== 64) {
    throw new Error(`Invalid length of data, expected 64, got ${data.length}`)
  }
  let result = ''
  for (let i = 0; i < 4; i++) {
    const slice = data.slice(i * 16, (i + 1) * 16)
    const digest = binaryToDigest(slice)
    let hex = digest.toString(16).toUpperCase()
    if (hex.length < 4) {
      hex = '0'.repeat(4 - hex.length) + hex
    }
    result += hex
  }
  return result
}

function getKeyBytes(key: string) {
  return stringToByte(key)
}

function strToBt(str: string): number[] {
  return stringToByte(str).flat()
}

/**
 * Encode a string to a 4-letter group of bit array
 * the shape is (n, 64) where n is group amount.
 * @param s The input string
 */
function stringToByte(s: string): number[][] {
  const groups = Math.ceil(s.length / 4)
  const result: number[][] = Array.from({ length: groups })
  for (let i = 0; i < groups; i++) {
    let groupString = s.substring(i * 4, i * 4 + 4)
    if (groupString.length < 4) {
      groupString += '\0'.repeat(4 - groupString.length)
    }
    const groupByte = []
    for (let j = 0; j < 4; j++) {
      const charCode = groupString.charCodeAt(j)
      const chatCodeByte = digestToBinary(charCode, 16)
      groupByte.push(...chatCodeByte)
    }
    result[i] = groupByte
  }
  return result
}

function encrypt(dataByte: number[], keyByte: number[]) {
  const keys = generateKeys(keyByte)
  const permutedData = initPermute(dataByte)
  let leftData = permutedData.slice(0, 32)
  let rightData = permutedData.slice(32)
  const product = (_leftData: number[], _rightData: number[], _key: number[]) => {
    const newLeftData = _rightData
    const newRightData = xor(pPermute(sBoxPermute(xor(expandPermute(_rightData), _key))), _leftData)
    return [newLeftData, newRightData]
  }
  for (let i = 0; i < 16; i++) {
    [leftData, rightData] = product(leftData, rightData, keys[i])
  }
  return finallyPermute(rightData.concat(leftData))
}

function initPermute(originalData: number[]) {
  return permute1D(INITIAL_PERMUTE_BOX, originalData, 64)
}

function expandPermute(rightData: number[]) {
  return permute1D(EXPAND_PERMUTE_BOX, rightData, 48)
}

function xor(leftByte: number[], rightByte: number[]): number[] {
  const result: number[] = Array.from({ length: leftByte.length })
  for (let i = 0; i < leftByte.length; i++) {
    result[i] = leftByte[i] ^ rightByte[i]
  }
  return result
}

function vectorDotProduct(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    throw new Error(`Invalid length of vector, expected ${vector1.length}, got ${vector2.length}`)
  }
  return vector1.reduce((acc, cur, index) => acc + cur * vector2[index], 0)
}

function sBoxPermutePosition(expandByte: number[]): number[][] {
  if (expandByte.length !== 48) {
    throw new Error(`Invalid length of expandByte, expected 48, got ${expandByte.length}`)
  }
  const result = Array.from({ length: 8 }, () => {
    return Array.from({ length: 2 }, () => 0)
  })
  for (let group = 0; group < 8; group++) {
    const i = vectorDotProduct(
      [expandByte[group * 6 + 0], expandByte[group * 6 + 5]],
      [S_PERMUTE_BOX_POSITION[0], S_PERMUTE_BOX_POSITION[5]],
    )
    const j = vectorDotProduct(
      expandByte.slice(group * 6 + 1, group * 6 + 5),
      S_PERMUTE_BOX_POSITION.slice(1, 5),
    )
    result[group][0] = i
    result[group][1] = j
  }
  return result
}

function digestToBinary(digest: number, length?: number): number[] {
  const result: number[] = []
  // Convert digest to binary
  let quotient = digest
  while (quotient > 0) {
    result.unshift(quotient % 2)
    quotient = Math.floor(quotient / 2)
  }
  // Add padding
  if (length) {
    while (result.length < length) {
      result.unshift(0)
    }
  }
  return result
}

function binaryToDigest(binary: number[]): bigint {
  // Remove padding
  while (binary[0] === 0) {
    binary.shift()
  }
  // Convert binary to digest
  let result = BigInt(0)
  for (let i = 0; i < binary.length; i++) {
    result += BigInt(binary[i]) * BigInt(2 ** (binary.length - 1 - i))
  }
  return result
}

// Complete
function sBoxPermute(expandByte: number[]) {
  const result = []
  const position = sBoxPermutePosition(expandByte)
  for (let i = 0; i < position.length; i++) {
    const [row, column] = position[i]
    const digest = S_PERMUTE_BOX[i][row][column]
    const binary = digestToBinary(digest, 4)
    result.push(...binary)
  }
  return result
}

function permute1D<T>(permuteBox: number[], data: T[], length: number) {
  // Validate phase
  const max = Math.max(...permuteBox)
  if (max >= data.length) {
    throw new Error(`Invalid permuteBox, expected max < ${data.length}, got ${max}`)
  }
  // Permute phase
  const result: T[] = Array.from({ length })
  for (let i = 0; i < length; i++) {
    result[i] = data[permuteBox[i]]
  }
  return result
}

function pPermute(sBoxByte: number[]): number[] {
  return permute1D(P_PERMUTE_BOX, sBoxByte, 32)
}

function finallyPermute(endByte: number[]) {
  return permute1D(FINAL_PERMUTE_BOX, endByte, 64)
}

function offsetVector(vector: number[], offset: number): number[] {
  return vector.slice(offset).concat(vector.slice(0, offset))
}

function generateKeys(keyByte: number[]) {
  let key: number[] = Array.from({ length: 56 })
  const result = Array.from({ length: 16 }, () => Array.from({ length: 48 }, () => 0))

  for (let i = 0; i < 7; i++) {
    for (let j = 0, k = 7; j < 8; j++, k--) {
      key[i * 8 + j] = keyByte[8 * k + i]
    }
  }

  for (let i = 0; i < 16; i++) {
    const left = offsetVector(key.slice(0, 28), KEY_GENERATE_OFFSET[i])
    const right = offsetVector(key.slice(28), KEY_GENERATE_OFFSET[i])
    key = left.concat(right)
    result[i] = permute1D(KEY_SECOND_PERMUTE_BOX, key, 48)
  }
  return result
}

export {
  getKeyBytes,
  encrypt,
  strToBt,
  encryptString,
  stringToByte,
  initPermute,
  expandPermute,
  xor,
  sBoxPermute,
  pPermute,
  finallyPermute,
  generateKeys,
  digestToBinary,
}
