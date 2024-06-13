import { describe, expect, it } from 'vitest'
import * as rewritten from '../lib/des'
import * as original from './original'

// Generate a random string with given length
function randomString(length: number): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return result
}

function randomByte(length: number): number[] {
  return Array.from({ length }, () => Math.floor(Math.random() + 0.5))
}

function generateTestPair({
  amount,
  keyLength,
  dataLength,
}: {
  amount: number
  keyLength: number
  dataLength: number
}) {
  const keyList = Array.from({ length: amount }, () => {
    return Array.from({ length: 3 }, () => randomString(keyLength))
  })
  const dataList = Array.from({ length: amount }, () => randomString(dataLength))
  return {
    keyList,
    dataList,
  }
}

describe('test strEnc', () => {
  it('with 1, 2, 3', () => {
    const key = ['1', '2', '3']
    const dataList = Array.from({ length: 10 }, () => randomString(20))
    for (let i = 0; i < dataList.length; i++) {
      const rewrittenResult = rewritten.encryptString(dataList[i], key)
      const originalResult = original.strEnc(dataList[i], key[0], key[1], key[2])
      expect(rewrittenResult).toEqual(originalResult)
    }
  })
  it('with key length < 4 and data length < 4', () => {
    const { keyList, dataList } = generateTestPair({ amount: 50, keyLength: 3, dataLength: 3 })
    for (let i = 0; i < keyList.length; i++) {
      const rewrittenResult = rewritten.encryptString(dataList[i], keyList[i])
      const originalResult = original.strEnc(dataList[i], keyList[i][0], keyList[i][1], keyList[i][2])
      expect(rewrittenResult).toEqual(originalResult)
    }
  })
  it('with key length > 4 and data length < 4', () => {
    const { keyList, dataList } = generateTestPair({ amount: 50, keyLength: 5, dataLength: 3 })
    for (let i = 0; i < keyList.length; i++) {
      const rewrittenResult = rewritten.encryptString(dataList[i], keyList[i])
      const originalResult = original.strEnc(dataList[i], keyList[i][0], keyList[i][1], keyList[i][2])
      expect(rewrittenResult).toEqual(originalResult)
    }
  })
  it('with key length > 4 and data length > 4', () => {
    const { keyList, dataList } = generateTestPair({ amount: 50, keyLength: 5, dataLength: 6 })
    for (let i = 0; i < keyList.length; i++) {
      const rewrittenResult = rewritten.encryptString(dataList[i], keyList[i])
      const originalResult = original.strEnc(dataList[i], keyList[i][0], keyList[i][1], keyList[i][2])
      expect(rewrittenResult).toEqual(originalResult)
    }
  })
})

describe('test xor', () => {
  it('test xor with 10 random byte arrays', () => {
    const byteArray = Array.from({ length: 10 }, () => {
      return Array.from({ length: 2 }, () => randomByte(10))
    })
    for (let i = 0; i < byteArray.length; i++) {
      expect(rewritten.xor(byteArray[i][0], byteArray[i][1])).toEqual(original.xor(byteArray[i][0], byteArray[i][1]))
    }
  })
})

describe('test pPermute', () => {
  it('test pPermute with 10 random byte arrays', () => {
    const byteArray = Array.from({ length: 10 }, () => randomByte(48))
    for (let i = 0; i < byteArray.length; i++) {
      expect(rewritten.pPermute(byteArray[i])).toEqual(original.pPermute(byteArray[i]))
    }
  })
})

describe('test sBoxPermute', () => {
  it('test sBoxPermute with 10 random byte arrays', () => {
    const byteArray = Array.from({ length: 10 }, () => randomByte(48))
    for (let i = 0; i < byteArray.length; i++) {
      expect(rewritten.sBoxPermute(byteArray[i])).toEqual(original.sBoxPermute(byteArray[i]))
    }
  })
})

describe('test digestToBinary', () => {
  it('test 4, 7, 16 with dynamic length', () => {
    expect(rewritten.digestToBinary(4)).toEqual([1, 0, 0])
    expect(rewritten.digestToBinary(7)).toEqual([1, 1, 1])
    expect(rewritten.digestToBinary(16)).toEqual([1, 0, 0, 0, 0])
  })
  it('test 4, 7, 16 with fixed length', () => {
    expect(rewritten.digestToBinary(4, 5)).toEqual([0, 0, 1, 0, 0])
    expect(rewritten.digestToBinary(7, 5)).toEqual([0, 0, 1, 1, 1])
    expect(rewritten.digestToBinary(16, 8)).toEqual([0, 0, 0, 1, 0, 0, 0, 0])
  })
})

describe('test initPermute', () => {
  it('test initPermute with 10 random byte arrays', () => {
    const byteArray = Array.from({ length: 10 }, () => randomByte(64))
    for (let i = 0; i < byteArray.length; i++) {
      expect(rewritten.initPermute(byteArray[i])).toEqual(original.initPermute(byteArray[i]))
    }
  })
})

describe('test finallyPermute', () => {
  it('test finallyPermute with 10 random byte arrays', () => {
    const byteArray = Array.from({ length: 10 }, () => randomByte(64))
    for (let i = 0; i < byteArray.length; i++) {
      expect(rewritten.finallyPermute(byteArray[i])).toEqual(original.finallyPermute(byteArray[i]))
    }
  })
})

describe('test generateKeys', () => {
  it('test generateKeys with 10 random byte arrays', () => {
    const byteArray = Array.from({ length: 10 }, () => randomByte(64))
    for (let i = 0; i < byteArray.length; i++) {
      expect(rewritten.generateKeys(byteArray[i])).toEqual(original.generateKeys(byteArray[i]))
    }
  })
})

describe('test stringToByte', () => {
  it('test stringToByte with 10 random strings with length < 4', () => {
    const stringList = Array.from({ length: 10 }, () => randomString(3))
    for (let i = 0; i < stringList.length; i++) {
      const originalResult = original.strToBt(stringList[i])
      expect(rewritten.stringToByte(stringList[i]).flat()).toEqual(originalResult)
    }
  })
  it('test stringToByte with 10 random strings with length > 4', () => {
    const stringList = Array.from({ length: 10 }, () => randomString(12))
    for (let i = 0; i < stringList.length; i++) {
      const targetString = stringList[i]
      const originalResult: number[][] = []
      const groups = targetString.length / 4
      for (let i = 0; i < groups; i++) {
        const group = targetString.slice(i * 4, (i + 1) * 4)
        originalResult.push(original.strToBt(group))
      }
      const result = rewritten.stringToByte(targetString)
      expect(result).toEqual(originalResult)
    }
  })
})

describe('test enc', () => {
  it('test enc with random bytes', () => {
    const dataByteArray = Array.from({ length: 10 }, () => randomByte(64))
    const keyByteArray = Array.from({ length: 10 }, () => randomByte(64))
    for (let i = 0; i < dataByteArray.length; i++) {
      const originalResult = original.enc(dataByteArray[i], keyByteArray[i])
      const rewrittenResult = rewritten.encrypt(dataByteArray[i], keyByteArray[i])
      expect(rewrittenResult).toEqual(originalResult)
    }
  })
})
