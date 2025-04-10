import openai
from openai import OpenAI
import os
import timeit
import sys
import json
import tiktoken
openai.api_key_path = "./src/openaikey/openai.key"
os.environ["OPENAI_API_KEY"]= "your_openai_key"
client = OpenAI()
complete_log = []

def chat_tokenize(text, engine="gpt-3.5-turbo"):
  # if engine == "gpt-3.5-turbo": engine = "gpt-3.5-turbo-0301"
  encoding = tiktoken.encoding_for_model(engine)
  tokens = encoding.encode(text)
  token_bytes = [encoding.decode_single_token_bytes(token) for token in tokens]
  decoded = []
  for token in token_bytes:
    try:
      decoded.append(token.decode("utf-8"))
    except:
      decoded.append("<FAILED>")
  return {
    "count": len(tokens),
    "tokens": tokens,
    "decoded_tokens": decoded,
    "text": text
  }

def chat_token_count(messages, engine="gpt-3.5-turbo"):
  # if engine == "gpt-3.5-turbo": engine = "gpt-3.5-turbo-0301"
  encoding = tiktoken.encoding_for_model(engine)
  tokens_per_message = 4
  tokens_per_name = 1
  # if engine == "gpt-3.5-turbo":
  #   tokens_per_message = 4
  #   tokens_per_name = 1
  # else:
  #   raise Exception(f"Unknown engine: {engine}")
  num_tokens = 0
  for message in messages:
    num_tokens += tokens_per_message
    for key, value in message.items():
      num_tokens += len(encoding.encode(value))
      if key == "name":
        num_tokens += tokens_per_name
  num_tokens += 3  # every reply is primed with <|start|>assistant<|message|>
  return num_tokens

def chat_complete(messages, max_length, stop, temp=0, stream=False, engine="gpt-4-turbo"):
  # if engine == "gpt-3.5-turbo": engine = "gpt-3.5-turbo-0301"
  # if engine == "gpt-4": engine = "gpt-4-1106-preview"
  complete_log.append(f"[complete_prompt]  max_length: {max_length}  temp: {temp}  engine: {engine}  len(prompt): {len(str(messages))}  stop: {stop}")
  result = None
  
  try:
    time1 = timeit.default_timer()
    res = client.chat.completions.create(
      model=engine,
      messages=messages,
      max_tokens=max_length,
      temperature=temp,
      stop=stop,
      stream=stream,
      n=1
    )
    time2 = timeit.default_timer()
    timespan = time2 - time1
    result = {
      "completion_id": res.id,
      "completion_content": res.choices[0].message.content,
      "completion_model": res.model,
      "completion_usage": {"completion_tokens": res.usage.completion_tokens, "prompt_tokens": res.usage.prompt_tokens},
      "timespan": timespan,
      "error_msg": None
    }
  except Exception as e:
    result = {
      "error_msg": str(e)
    }
  return result


import time
import hashlib
import os
_FILECACHE_ENABLED = True
def file_cached(func_id, force_new=False, interval=500, valid_f=None, max_retry=10, retry_f=None):
  cache_folder = "LLM_cache"
  if not os.path.exists(cache_folder):
    os.mkdir(cache_folder)
  collision_filepath = cache_folder + "/__collisions.jsonl"
  collision_f = open(collision_filepath, "a")
  def _cache_get(store_key):
    # check if <cache_folder>/<store_key>.json exists
    # if exists, return json.load(<cache_folder>/<store_key>.json)
    cache_path = cache_folder + "/" + store_key + ".json"
    if not os.path.exists(cache_path): raise Exception("Cache file not found: " + cache_path)

    ### copy it to "./LLM_cache" folder
    # os.system(f"cp {cache_path} ./LLM_cache/")

    with open(cache_path, "r") as f:
      return json.load(f)
  def _cache_set(store_key, data):
    # write json.dump(data) to <cache_folder>/<store_key>.json
    cache_path = cache_folder + "/" + store_key + ".json"
    with open(cache_path, "w") as f:
      json.dump(data, f)
    ### copy it to "./LLM_cache" folder
    # os.system(f"cp {cache_path} ./LLM_cache/")
  def _file_cached_deco(func):
    global _FILECACHE_ENABLED, _FILECACHE_COLLISION_DICT
    def wrapper(**kwargs):
      params = kwargs
      param_key = json.dumps(params)
      # get sha256 of param_key
      hash = hashlib.sha256(param_key.encode('utf-8')).hexdigest()
      store_key = f"APICacheV1-{func_id}-" + hash
      failure_key = f"APIFailV1-{func_id}-" + hash
      ret_val = None
      if _FILECACHE_ENABLED and not force_new:
        try:
          result = _cache_get(store_key)
          existing_param_key = json.dumps(result["params"])
          if existing_param_key != param_key:
            to_append = {"fetching": param_key, "existing": existing_param_key}
            collision_f.write(json.dumps(to_append) + "\n", flush=True)
            raise Exception("COLLISION!!! param_key mismatch! store_key=" + store_key)
          ret_val = result["ret_val"]
          if valid_f is not None and not valid_f(ret_val):
            ret_val = None
            raise Exception("INVALID!!! cached result failed validation! store_key=" + store_key)
        except Exception as e:
          # print("[logviz_cached]", e)
          pass
      if ret_val is None:
        retry_count = 0
        while True:
          ret_val = func(**kwargs)
          if valid_f is None:
            break
          if valid_f(ret_val):
            break
          if retry_f is not None and retry_f(ret_val):
            retry_count += 1
            if retry_count >= max_retry:
              failure_msg = "Validation failed after max_retry | " + failure_key
              _cache_set(failure_key, {"_failure_msg": failure_msg, "func_id": func_id, "params": params, "ret_val": ret_val})
              raise Exception(failure_msg)
            time.sleep(interval)
            print("[logviz_cached] Validation failed and retry allowed. Retrying ...")
          else:
            print(ret_val)
            failure_msg = "Not valid & not retryable | " + failure_key
            _cache_set(failure_key, {"_failure_msg": failure_msg, "func_id": func_id, "params": params, "ret_val": ret_val})
            raise Exception(failure_msg)
        if _FILECACHE_ENABLED:
          try:
            _cache_set(store_key, {"func_id": func_id, "params": params, "ret_val": ret_val})
          except Exception as e:
            print("[logviz_cached]", e)
      return ret_val
    return wrapper
  return _file_cached_deco

def _complete_prompt_cached_retry_f(ret_val):
  if ret_val is not None:
    if "error_msg" in ret_val:
      error_msg = ret_val["error_msg"]
      if error_msg is not None:
        if "That model is currently overloaded with other requests." in error_msg:
          return True
  return False

@file_cached("chatgptcomp", interval=10, valid_f=lambda x: "completion_id" in x, retry_f=_complete_prompt_cached_retry_f, max_retry=10)
def complete_prompt_cached(**kwargs):
  return chat_complete(**kwargs)


def turbo_chat_completion(system, chat_history, user, engine, max_length=-1, temp=0):
    # chat_history should be a list of (user, assistant) tuples
    gpt_msg = []
    gpt_msg.append({"role": "system", "content": system})
    for item in chat_history: assert len(item) == 2, "chat_history should be a list of (user, assistant) tuples. Get: " + str(item)
    for hist_user, hist_assistant in chat_history:
      gpt_msg.append({"role": "user", "content": hist_user})
      gpt_msg.append({"role": "assistant", "content": hist_assistant})
    gpt_msg.append({"role": "user", "content": user})
    if max_length == -1:
      prompt_count = chat_token_count(gpt_msg, engine=engine)

      if engine == "gpt-4-1106-preview":
        max_length = 4096
      elif engine.find("-32k") >= 0:
        max_length = 8192 * 4 - prompt_count # 32k context length
      else:
        max_length = 4096 # 32k context length
      # print(f"[ST_LLM_Querier] Token consumed: {prompt_count}")

    # print(engine)
    result = complete_prompt_cached(messages=gpt_msg, max_length=max_length, stop="", temp=temp, stream=False, engine=engine)
    
    if "error_msg" in result and result["error_msg"] is not None:
      return result

    return {
      "completion": result["completion_content"],
      "usage": result["completion_usage"],
      "timespan": result["timespan"],
      "prompt": gpt_msg,
    }


if __name__ == "__main__":
    

    res = turbo_chat_completion("You are a helpful assistant.", [], "hello, what is the answer of 33 * 66?", engine="gpt-4-1106-preview", max_length=-1, temp=0)
    print(res['completion'])
  

