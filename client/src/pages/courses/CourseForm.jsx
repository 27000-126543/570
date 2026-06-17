import React, { useState, useEffect } from 'react'
import { Form, Input, InputNumber, Select, DatePicker, Button, Card, Space, message, Row, Col } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import request from '../../utils/request'

const { Option } = Select
const { TextArea } = Input
const { RangePicker } = DatePicker

export default function CourseForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const isEdit = !!id

  useEffect(() => {
    if (isEdit) loadCourse()
  }, [id])

  const loadCourse = async () => {
    setLoading(true)
    try {
      const res = await request.get(`/courses/${id}`)
      const c = res.data
      form.setFieldsValue({
        ...c,
        dateRange: [dayjs(c.start_date), dayjs(c.end_date)]
      })
    } finally {
      setLoading(false)
    }
  }

  const onFinish = async (values) => {
    setSaving(true)
    try {
      const data = {
        ...values,
        start_date: values.dateRange[0].format('YYYY-MM-DD'),
        end_date: values.dateRange[1].format('YYYY-MM-DD')
      }
      delete data.dateRange

      if (isEdit) {
        await request.put(`/courses/${id}`, data)
        message.success('课程更新成功')
      } else {
        await request.post('/courses', data)
        message.success('课程创建成功')
      }
      navigate('/courses')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <h2 className="page-title">{isEdit ? '编辑课程' : '新建课程'}</h2>
        </Space>
      </div>

      <Card loading={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            capacity: 50,
            required_hours: 0,
            hours: 8,
            status: 'draft'
          }}
        >
          <Row gutter={24}>
            <Col md={12}>
              <Form.Item name="name" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}>
                <Input placeholder="请输入课程名称" maxLength={100} />
              </Form.Item>
            </Col>
            <Col md={12}>
              <Form.Item name="code" label="课程编码" rules={[{ required: true, message: '请输入课程编码' }]}>
                <Input placeholder="如：TECH-001" disabled={isEdit} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col md={8}>
              <Form.Item name="category" label="课程分类">
                <Select placeholder="请选择分类">
                  <Option value="技术培训">技术培训</Option>
                  <Option value="管理培训">管理培训</Option>
                  <Option value="市场培训">市场培训</Option>
                  <Option value="职业素养">职业素养</Option>
                  <Option value="安全培训">安全培训</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col md={8}>
              <Form.Item name="hours" label="培训学时" rules={[{ required: true, message: '请输入学时' }]}>
                <InputNumber min={1} max={200} style={{ width: '100%' }} addonAfter="学时" />
              </Form.Item>
            </Col>
            <Col md={8}>
              <Form.Item name="required_hours" label="学前要求学时">
                <InputNumber min={0} max={200} style={{ width: '100%' }} addonAfter="学时" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col md={8}>
              <Form.Item name="capacity" label="报名名额">
                <InputNumber min={1} max={500} style={{ width: '100%' }} addonAfter="人" />
              </Form.Item>
            </Col>
            <Col md={8}>
              <Form.Item name="teacher" label="授课讲师">
                <Input placeholder="请输入讲师姓名" />
              </Form.Item>
            </Col>
            <Col md={8}>
              <Form.Item name="location" label="培训地点">
                <Input placeholder="请输入培训地点" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="dateRange" label="培训时间" rules={[{ required: true, message: '请选择时间' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="description" label="课程描述">
            <TextArea rows={4} placeholder="请输入课程描述" maxLength={1000} showCount />
          </Form.Item>

          {isEdit && (
            <Form.Item name="status" label="课程状态">
              <Select>
                <Option value="draft">草稿</Option>
                <Option value="published">已发布</Option>
                <Option value="completed">已完成</Option>
                <Option value="cancelled">已取消</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
                {isEdit ? '保存修改' : '创建课程'}
              </Button>
              <Button onClick={() => navigate(-1)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
