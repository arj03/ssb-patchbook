const flumeView = require('flumeview-reduce')

const flattenDeep = require('lodash/flattenDeep')

var view;

module.exports = {
  name: 'patchbook',
  version: '1.0.0',
  manifest: {
    get: 'async',
    stream: 'source'
  },
  init: function (ssbServer, config) {
    view = ssbServer._flumeUse('patchbook', flumeView(
      16, // version
      reduce,
      map,
      null, //codec
      initialState()
    ))

    return {
      get: view.get,
      stream: view.stream
    }
  }
}

function reduce(result, msg) {
  if (!msg) return result

  const { author, content } = msg.value
  
  if (content.type == 'bookclub') {
    console.log("got book", content.title)
    var book = {
      key: msg.key,
      common: content,
      subjective: {}
    }
    result[msg.key] = book
  }
  else if (content.type == 'post')
  {
    console.log("got book comment")
    
    Object.values(view.value.value).forEach(book => {
      Object.values(book.subjective).forEach(s => {
        if (content.root in s.allKeys) {
          console.log("on ", book.title)
          s.comments.push(msg.value)
        }
      })
    })
  }
  else
  {
    console.log("got book update", view.value.value[content.about].common.title)

    const { rating, ratingMax, ratingType, shelve, genre, review } = msg.value.content

    let book = view.value.value[content.about]

    let allKeys = (book.subjective[msg.value.author] || { allKeys: [] }).allKeys
    allKeys.push(msg.key)

    if (rating || ratingMax || ratingType || shelve || genre || review) {
      book.subjective[msg.value.author] = {
        key: msg.key,
        allKeys,
        rating,
        ratingMax,
        ratingType,
        shelve,
        genre,
        review,
        comments: []
      }

      updateSubjectives(view.value.value)

    } else
      book.common = Object.assign({}, book.common, msg.value.content)

    result[msg.key] = book
  }

  return result
}

var subjectives = []

function updateSubjectives(books)
{
  subjectives = flattenDeep(Object.values(Object.values(books).map(b => b.subjective)).map(s => Object.values(s).map(s2 => s2.allKeys)))
}

function map(msg) {
  if (!msg.value.content) return

  const { type, about, root } = msg.value.content

  if (!subjectives) updateSubjectives(view.value.value)
  
  if (type == 'bookclub')
    return msg
  else if (type == 'post' && subjectives.includes(root))
    return msg
  else if (type == 'about' && about in view.value.value)
    return msg
//  else if (type == 'bookclub-update')
//    return msg
}

function initialState () {
  return {}
}
