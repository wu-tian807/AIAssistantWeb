import requests
import os
from typing import Dict, Optional, Union
from config import OCR_API_KEY, OCR_COMMON_API_URL
from utils.files.file_config import ATTACHMENT_TYPES, AttachmentType

class ImageOCR:
    def __init__(self):
        self.api_key = OCR_API_KEY
        self.common_url = OCR_COMMON_API_URL

    def image_to_text(
        self, 
        image_path: str, 
        use_common_ocr: bool = True,
        ocr_params: Dict = None
    ) -> Dict:
        """
        将图片转换为文字
        Args:
            image_path: 图片路径
            use_common_ocr: 是否使用通用OCR API
            ocr_params: OCR参数，包含:
                - rec_mode: 'auto'/'document'/'formula'
                - enable_img_rot: bool
                - inline_formula_wrapper: List[str]
                - isolated_formula_wrapper: List[str]
        Returns:
            Dict: 包含识别结果的字典
        """
        try:
            print(f"开始处理图片: {image_path}")
            
            if not os.path.exists(image_path):
                print(f"错误：文件不存在: {image_path}")
                return {'success': False, 'error': 'File not found'}
            
            # 获取文件扩展名和MIME类型
            file_ext = os.path.splitext(image_path)[1].lower()
            print(f"文件扩展名: {file_ext}")
            
            mime_type = next(
                (mime for mime in ATTACHMENT_TYPES[AttachmentType.IMAGE]['mime_types']
                 if mime.endswith(file_ext.replace('.', ''))),
                'image/png'
            )
            print(f"使用的MIME类型: {mime_type}")
            
            headers = {
                'token': self.api_key
            }
            
            # 准备文件和参数
            files = [
                ('file', (os.path.basename(image_path), open(image_path, 'rb'), mime_type))
            ]
            
            # 处理OCR参数
            data = {}
            if use_common_ocr and ocr_params:
                data.update({
                    'rec_mode': ocr_params.get('rec_mode', 'auto'),
                    'enable_img_rot': ocr_params.get('enable_img_rot', False),
                })
                
                # 添加公式包装器参数
                if 'inline_formula_wrapper' in ocr_params:
                    data['inline_formula_wrapper'] = ocr_params['inline_formula_wrapper']
                if 'isolated_formula_wrapper' in ocr_params:
                    data['isolated_formula_wrapper'] = ocr_params['isolated_formula_wrapper']
            
            print(f"请求参数: {data}")
            print(f"请求URL: {self.common_url}")
            
            # 发送请求
            print("开始发送请求...")
            response = requests.post(
                self.common_url,
                headers=headers,
                files=files,
                data=data
            )
            print(f"请求状态码: {response.status_code}")
            print(f"响应内容: {response.text[:200]}...")
            
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print(f"请求异常: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
        except Exception as e:
            print(f"其他异常: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_text_content(self, ocr_result: Dict) -> Optional[str]:
        """
        从OCR结果中提取文本内容
        Args:
            ocr_result: OCR返回的结果字典
        Returns:
            str: 提取的文本内容，如果失败返回None
        """
        try:
            if ocr_result.get('status'):
                results = ocr_result.get('res')
                if isinstance(results, dict):
                    # 处理文档类型结果
                    if results.get('type') == 'doc':
                        return results.get('info', {}).get('markdown')
                    # 处理公式类型结果
                    elif results.get('type') == 'formula':
                        if results.get('conf') and results.get('info'):
                            return results['info']
                    # 处理单个公式结果
                    elif 'latex' in results:
                        return results['latex'] if results.get('conf') else None
                    elif 'text' in results:
                        return results['text']
                elif isinstance(results, list):
                    # 处理多个结果
                    texts = []
                    for result in results:
                        if isinstance(result, dict):
                            if result.get('type') == 'formula' and result.get('conf'):
                                texts.append(result.get('info', ''))
                            elif 'latex' in result and result.get('conf'):
                                texts.append(result['latex'])
                            elif 'text' in result:
                                texts.append(result['text'])
                    return '\n'.join(texts) if texts else None
                return None
            return None
        except Exception as e:
            print(f"解析结果时出错: {str(e)}")
            return None